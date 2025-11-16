#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import json
import sphinx
from sphinx import addnodes as sphinx_addnodes
from packaging import version
import os
import shutil
from collections import Counter
from pathlib import Path
from docutils import nodes as docutils_nodes
from multiprocessing import Manager, Queue
from fnmatch import fnmatch

__version__ = "0.8.1"


def setup(app):
    app.add_config_value("visualized_clusters", [], "html")
    app.add_config_value("visualized_auto_cluster", False, "html")
    app.connect("builder-inited", create_objects)
    app.connect("doctree-resolved", get_links)
    app.connect("build-finished", create_json)

    return {
        "version": __version__,
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }


def get_page_cluster(page_path, clusters_config, auto_cluster_by_directory=False):
    """
    Determine which cluster a page belongs to based on glob patterns or directory structure.

    Args:
        page_path: Path to the page (e.g., "/example/lorem.html")
        clusters_config: List of cluster configurations from conf.py
        auto_cluster_by_directory: If True, automatically assign cluster names based on
                                   the first subdirectory in the path

    Returns:
        Cluster name if matched, None otherwise
    """
    # Remove leading slash and .html extension for pattern matching
    normalized_path = page_path.lstrip('/').rstrip('.html')

    # First, check manual cluster configurations
    for cluster in clusters_config:
        name = cluster.get('name')
        patterns = cluster.get('patterns', [])

        for pattern in patterns:
            if fnmatch(normalized_path, pattern):
                return name

    # If no manual cluster matched and auto-clustering is enabled, use directory name
    if auto_cluster_by_directory:
        # Split the path and get the first directory component
        path_parts = normalized_path.split('/')
        if len(path_parts) > 1:
            # Page is in a subdirectory, use the first directory as cluster name
            return path_parts[0]

    return None


def get_intersphinx_project(app, url):
    """
    Get the intersphinx project name for a URL.

    Args:
        app: Sphinx application object
        url: The URL to check

    Returns:
        Project name if the URL matches an intersphinx mapping, None otherwise
    """
    # Get intersphinx_mapping from config
    intersphinx_mapping = getattr(app.config, 'intersphinx_mapping', {})

    for project_name, project_info in intersphinx_mapping.items():
        # Sphinx processes intersphinx_mapping into: {name: (name, (url, (inventory,)))}
        # or the original format: {name: (url, inventory)}
        base_url = None

        if isinstance(project_info, tuple):
            if len(project_info) >= 2 and isinstance(project_info[1], tuple):
                # Processed format: ('sphinx', ('https://...', (None,)))
                base_url = project_info[1][0] if len(project_info[1]) > 0 else None
            elif len(project_info) >= 1:
                # Original format: ('https://...', None)
                base_url = project_info[0]
        else:
            base_url = project_info

        # Normalize base_url (remove trailing slash for comparison)
        if isinstance(base_url, str):
            base_url_normalized = base_url.rstrip('/')
            url_normalized = url.rstrip('/')

            # Check if URL matches this project's base URL
            # Either exact match or URL starts with base_url followed by /
            if (url_normalized == base_url_normalized or
                url_normalized.startswith(base_url_normalized + '/')):
                return project_name

    return None


def get_intersphinx_display_name(app, url, project_name):
    """
    Get the display name for an intersphinx URL from the inventory.

    Args:
        app: Sphinx application object
        url: The full URL to the external page
        project_name: The intersphinx project name

    Returns:
        Display name from inventory if found, otherwise None
    """
    # Access the intersphinx inventory from the environment
    env = app.env

    # Check if intersphinx inventory is available
    if not hasattr(env, 'intersphinx_named_inventory'):
        return None

    named_inventory = env.intersphinx_named_inventory

    # Get the inventory for this specific project
    if project_name not in named_inventory:
        return None

    project_inventory = named_inventory[project_name]

    # Normalize the URL for comparison (remove trailing slash)
    url_normalized = url.rstrip('/')
    url_no_fragment = url_normalized.split('#')[0]

    # Prioritize certain object types for page-level matches
    # std:doc and std:label usually have the best display names for pages
    priority_types = ['std:doc', 'std:label']
    fallback_match = None

    # Search through all object types in the inventory
    # inventory structure: inventory[objtype][target] = (proj, version, uri, dispname)
    for objtype in priority_types:
        if objtype in project_inventory:
            objects = project_inventory[objtype]
            for target, (proj, version, uri, dispname) in objects.items():
                # Normalize the URI from inventory
                uri_normalized = uri.rstrip('/')
                uri_no_fragment = uri_normalized.split('#')[0]

                # Try matching: exact match or match without fragment
                if url_normalized == uri_normalized or url_no_fragment == uri_no_fragment:
                    # Use dispname if available (dispname is '-' when it equals the target)
                    if dispname and dispname != '-':
                        return dispname
                    else:
                        # Use the target name
                        if '.' in target:
                            return target.split('.')[-1]
                        return target

    # If no priority match, search all other types
    for objtype, objects in project_inventory.items():
        if objtype in priority_types:
            continue  # Skip priority types as we already checked them

        for target, (proj, version, uri, dispname) in objects.items():
            # Normalize the URI from inventory
            uri_normalized = uri.rstrip('/')
            uri_no_fragment = uri_normalized.split('#')[0]

            # Try matching: exact match or match without fragment
            if url_normalized == uri_normalized or url_no_fragment == uri_no_fragment:
                # Save the first match as fallback
                if fallback_match is None:
                    if dispname and dispname != '-':
                        fallback_match = dispname
                    else:
                        if '.' in target:
                            fallback_match = target.split('.')[-1]
                        else:
                            fallback_match = target

    return fallback_match


def create_objects(app):
    """
    Create objects when builder is initiated
    """
    builder = getattr(app, "builder", None)
    if builder is None:
        return

    manager = Manager()
    builder.env.app.pages = manager.dict() # an index of page names
    builder.env.app.references = manager.Queue() # a queue of every internal reference made between pages


def get_links(app, doctree, docname):
    """
    Gather internal and external link connections
    """

    #TODO handle troctree entries?
    #TODO get targets
    # for node in doctree.traverse(sphinx.addnodes.toctree):
    #     print(vars(node))

    for node in doctree.traverse(docutils_nodes.reference):
        if node.tagname == 'reference' and node.get('refuri'):
            refuri = node.attributes['refuri']

            # Handle internal references
            if node.get('internal'):
                # calulate path of the referenced page in relation to docname
                ref = refuri.split("#")[0]
                refname = os.path.abspath(os.path.join(os.path.dirname(f"/{docname}.html"), ref))[1:-5]

                # Determine the reference type based on classes or fragment
                ref_type = "ref"  # default
                target_path = f"/{refname}.html"

                # Check if this is a term reference (glossary term)
                # Term references have a fragment starting with "term-"
                if "#" in refuri and refuri.split("#")[1].startswith("term-"):
                    ref_type = "term"
                    # Keep the full path with fragment for term references
                    fragment = refuri.split("#")[1]
                    target_path = f"/{refname}.html#{fragment}"
                # Check if node has classes that indicate it's a term reference
                elif 'std-term' in node.get('classes', []):
                    ref_type = "term"
                    # Try to extract fragment if present
                    if "#" in refuri:
                        fragment = refuri.split("#")[1]
                        target_path = f"/{refname}.html#{fragment}"

                # add each link as an individual reference
                app.env.app.references.put((f"/{docname}.html", target_path, ref_type))

                docname_page = f"/{docname}.html"
                app.env.app.pages[docname_page] = True

                refname_page = f"/{refname}.html"
                app.env.app.pages[refname_page] = True

            # Handle external references (only intersphinx links)
            else:
                # Extract domain/URL for external links (keep fragment for accurate matching)
                external_url = refuri  # Keep the full URL including fragment

                # Only capture intersphinx links, skip regular external links
                project_name = get_intersphinx_project(app, external_url.split("#")[0])
                if project_name:
                    # Try to get the display name from the intersphinx inventory
                    display_name = get_intersphinx_display_name(app, external_url, project_name)

                    # Store intersphinx link with project name, URL, and display name
                    # Use a special separator that won't appear in URLs: "|||"
                    if display_name:
                        target_key = f"external|||{project_name}|||{external_url}|||{display_name}"
                    else:
                        # Fallback to old format if no display name found
                        target_key = f"external|||{project_name}|||{external_url}"

                    app.env.app.references.put((f"/{docname}.html", target_key, "intersphinx"))

                    docname_page = f"/{docname}.html"
                    app.env.app.pages[docname_page] = True

                    # Add external URL as a "page" with special prefix including project name
                    app.env.app.pages[target_key] = True


def build_toctree_hierarchy(app):
    """
    Take toctree_includes and build the document hierarchy while gathering page metadata.
    """
    node_map = {}
    data = app.env.toctree_includes

    for key, value in data.items():
        if key not in node_map:
            node_map[key] = {
                "id": key,
                "label": app.env.titles.get(key).astext(),
                "path": f"../../../{key}.html",
                "children": [],
            }

        for child in data[key]:
            if child not in node_map:
                title = app.env.titles.get(child)
                label = title.astext() if title is not None else child
                node_map[child] = {
                    "id": child,
                    "label": label,
                    "path": f"../../../{child}.html",
                    "children": [],
                }
            node_map[key]["children"].append(node_map[child])

    root_doc = app.builder.config.root_doc
    if root_doc not in node_map:
        # Build may have failed, return empty structure
        return {"id": root_doc, "label": root_doc, "path": f"../../../{root_doc}.html", "children": []}
    return node_map[root_doc]


def create_graphson(nodes, links, page_list, clusters_config):
    """
    Create GraphSON format for TinkerPop/sigma.js compatibility.
    Converts the nodes and links data into GraphSON v3.0 format.
    """
    vertices = []
    edges = []

    # Create vertices (nodes)
    for node in nodes:
        # Determine the vertex label based on node type
        if node.get("is_intersphinx"):
            vertex_label = "intersphinx"
        elif node.get("is_external"):
            vertex_label = "external"
        else:
            vertex_label = "page"

        vertex = {
            "id": node["id"],
            "label": vertex_label,
            "properties": {
                "name": node["label"],
                "path": node["path"]
            }
        }

        # Add cluster information if available
        if "cluster" in node and node["cluster"] is not None:
            vertex["properties"]["cluster"] = node["cluster"]

        # Mark external nodes
        if node.get("is_external"):
            vertex["properties"]["is_external"] = True

        # Mark intersphinx nodes
        if node.get("is_intersphinx"):
            vertex["properties"]["is_intersphinx"] = True

        vertices.append(vertex)

    # Create edges (links)
    for idx, link in enumerate(links):
        edge = {
            "id": idx,
            "label": link.get("type", "ref"),
            "inVLabel": "page",
            "outVLabel": "page",
            "inV": link["target"],
            "outV": link["source"],
            "properties": {
                "strength": link.get("strength", 1),
                "reference_count": link.get("reference_count", 1),
                "types": link.get("types", [link.get("type", "ref")])  # Store all link types
            }
        }
        edges.append(edge)

    # Collect all unique cluster names from nodes
    cluster_names = set()
    for node in nodes:
        if node.get("cluster") is not None:
            cluster_names.add(node["cluster"])

    # Build complete cluster list: manual configs + auto-generated clusters
    all_clusters = list(clusters_config) if clusters_config else []
    manual_cluster_names = {c.get("name") for c in clusters_config} if clusters_config else set()

    # Add auto-generated clusters that aren't already in manual config
    for cluster_name in cluster_names:
        if cluster_name not in manual_cluster_names:
            all_clusters.append({
                "name": cluster_name,
                "patterns": []  # Auto-generated clusters don't have patterns
            })

    # Include cluster configuration metadata
    graphson = {
        "vertices": vertices,
        "edges": edges
    }

    if all_clusters:
        graphson["clusters"] = all_clusters

    return graphson


def create_json(app, exception):
    """
    Create and copy static files for visualizations
    """
    page_list = list(app.env.app.pages.keys()) # list of pages with references
    clusters_config = app.config.visualized_clusters
    auto_cluster_by_directory = app.config.visualized_auto_cluster

    # create directory in _static and over static assets
    os.makedirs(Path(app.outdir) / "_static" / "sphinx-visualized", exist_ok=True)
    if version.parse(sphinx.__version__) >= version.parse("8.0.0"):
        # Use the 'force' argument if it's available
        sphinx.util.fileutil.copy_asset(
            os.path.join(os.path.dirname(__file__), "static"),
            os.path.join(app.builder.outdir, '_static', "sphinx-visualized"),
            force=True,
        )
    else:
        # Fallback for older versions without 'force' argument
        shutil.rmtree(Path(app.outdir) / "_static" / "sphinx-visualized")
        sphinx.util.fileutil.copy_asset(
            os.path.join(os.path.dirname(__file__), "static"),
            os.path.join(app.builder.outdir, '_static', "sphinx-visualized"),
        )

    # convert queue to list
    reference_list = []
    while not app.env.app.references.empty():
        reference_list.append(app.env.app.references.get())

    # convert queue to list (only contains internal refs and intersphinx links)
    # convert pages and groups to lists
    nodes = [] # a list of nodes and their metadata
    for page in page_list:
        # Check if this is an intersphinx link
        # Format: "external|||project_name|||URL" or "external|||project_name|||URL|||display_name"
        if page.startswith("external|||"):
            # Parse the format using ||| separator
            parts = page.split("|||")
            if len(parts) >= 4:
                # New format with display name: "external|||project_name|||URL|||display_name"
                project_name = parts[1]
                url = parts[2]
                display_name = parts[3]
            elif len(parts) >= 3:
                # Format without display name: "external|||project_name|||URL"
                project_name = parts[1]
                url = parts[2]
                display_name = project_name  # Fallback to project name
            else:
                # Malformed, skip
                continue

            nodes.append({
                "id": page_list.index(page),
                "label": display_name,  # Use display name from inventory
                "path": url,  # Use full URL as path
                "cluster": f"{project_name} (external)",  # Add (external) suffix to cluster name
                "is_external": True,
                "is_intersphinx": True,
            })
        # Check for old format with colon separator (backward compatibility)
        elif page.startswith("external:"):
            # Parse the old format
            parts = page.split(":", 3)
            if len(parts) >= 3:
                project_name = parts[1]
                url = parts[2]
                display_name = parts[3] if len(parts) >= 4 else project_name
            else:
                # Very old format "external:URL"
                url = page[9:]
                from urllib.parse import urlparse
                parsed = urlparse(url)
                project_name = parsed.netloc or url
                display_name = project_name

            nodes.append({
                "id": page_list.index(page),
                "label": display_name,
                "path": url,
                "cluster": f"{project_name} (external)",  # Add (external) suffix to cluster name
                "is_external": True,
                "is_intersphinx": True,
            })
        else:
            # Handle internal pages
            if app.env.titles.get(page[1:-5]):
                title = app.env.titles.get(page[1:-5]).astext()
            else:
                title = page

            # Determine cluster for this page
            cluster = get_page_cluster(page, clusters_config, auto_cluster_by_directory)

            nodes.append({
                "id": page_list.index(page),
                "label": title,
                "path": f"../../..{page}",
                "cluster": cluster,
            })

    # create object that links references between pages
    # Group references by (source, target) pair to aggregate link types
    edge_data = {}  # {(source_idx, target_idx): {"types": set(), "count": int}}

    for ref, count in Counter(reference_list).items():
        source_page, target_page, ref_type = ref

        # Strip fragments from URLs for internal pages only
        # (e.g., "/glossary.html#term-foo" -> "/glossary.html")
        # Don't strip from external pages which use "|||" separator
        if not source_page.startswith("external"):
            source_page_clean = source_page.split('#')[0]
        else:
            source_page_clean = source_page

        if not target_page.startswith("external"):
            target_page_clean = target_page.split('#')[0]
        else:
            target_page_clean = target_page

        # Skip if either page is not in the page list
        if source_page_clean not in page_list or target_page_clean not in page_list:
            continue

        # Create edge key
        source_idx = page_list.index(source_page_clean)
        target_idx = page_list.index(target_page_clean)
        edge_key = (source_idx, target_idx)

        # Initialize or update edge data
        if edge_key not in edge_data:
            edge_data[edge_key] = {"types": set(), "count": 0}

        edge_data[edge_key]["types"].add(ref_type)
        edge_data[edge_key]["count"] += count

    # Convert to links list
    links = []
    for (source_idx, target_idx), data in edge_data.items():
        # Convert set to sorted list for consistent output
        link_types = sorted(list(data["types"]))

        links.append({
            "target": target_idx,
            "source": source_idx,
            "strength": 1,
            "reference_count": data["count"],
            "type": link_types[0] if len(link_types) == 1 else "ref",  # Keep first type for backward compatibility
            "types": link_types,  # New field: all link types for this edge
        })

    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "links.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var links_data = {json.dumps(links, indent=4)};')

    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "nodes.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var nodes_data = {json.dumps(nodes, indent=4)};')

    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "toctree.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var toctree = {json.dumps(build_toctree_hierarchy(app), indent=4)};')

    # Create GraphSON format
    graphson = create_graphson(nodes, links, page_list, clusters_config)
    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "graphson.json"
    with open(filename, "w") as json_file:
        json.dump(graphson, json_file, indent=2)

    # Process inclusions for includes graph
    # Collect from env.dependencies which is populated after all documents are processed
    includes_list = []
    if hasattr(app.env, 'dependencies'):
        for docname, deps in app.env.dependencies.items():
            for included_file in deps:
                # Store as (source_doc, included_file)
                includes_list.append((f"/{docname}.html", included_file))

    # Build includes nodes and links
    includes_files = set()  # Track all files involved in inclusions
    for source_doc, included_file in includes_list:
        includes_files.add(source_doc)
        includes_files.add(str(included_file))  # Normalize to string (Sphinx can store as Path or str)

    # Create nodes for includes graph
    includes_nodes = []
    includes_file_list = sorted(includes_files)
    for file_path in includes_file_list:
        # Check if this is a documentation page or an included file
        if file_path.endswith('.html'):
            # This is a source document
            docname = file_path[1:-5]  # Remove leading / and .html
            if app.env.titles.get(docname):
                label = app.env.titles.get(docname).astext()
            else:
                label = os.path.basename(file_path)
            node_type = "document"
        else:
            # This is an included file - show full path relative to docs root
            # Use the path as-is (already relative from docs source or absolute)
            if os.path.isabs(file_path):
                # If absolute, convert to relative path from source directory
                try:
                    label = os.path.relpath(file_path, app.env.srcdir)
                except (ValueError, TypeError):
                    label = file_path
            else:
                # Already relative, use as-is
                label = file_path
            node_type = "include"

        includes_nodes.append({
            "id": includes_file_list.index(file_path),
            "label": label,
            "path": file_path,
            "type": node_type,
        })

    # Create links for includes graph
    includes_links = []
    includes_counts = Counter(includes_list)
    for (source_doc, included_file), count in includes_counts.items():
        includes_links.append({
            "source": includes_file_list.index(source_doc),
            "target": includes_file_list.index(included_file),
            "type": "include",
            "count": count,
        })

    # Write includes data files
    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "includes-nodes.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var includes_nodes_data = {json.dumps(includes_nodes, indent=4)};')

    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "includes-links.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var includes_links_data = {json.dumps(includes_links, indent=4)};')

    # Calculate glossary statistics
    glossary_stats = {
        "total_terms": 0,
        "total_references": 0,
        "unique_pages_with_terms": 0,
        "most_referenced_terms": []
    }

    # Filter term references
    term_references = [ref for ref in reference_list if ref[2] == "term"]
    glossary_stats["total_references"] = len(term_references)

    # Count unique pages that use terms
    pages_using_terms = set(ref[0] for ref in term_references)
    glossary_stats["unique_pages_with_terms"] = len(pages_using_terms)

    # Count references per term
    term_counts = Counter(ref[1] for ref in term_references)
    glossary_stats["total_terms"] = len(term_counts)

    # Get top 10 most referenced terms
    most_referenced = []
    for term_link, count in term_counts.most_common(10):
        # Extract term name from link format: /glossary.html#term-{name}
        term_name = term_link.split("#term-")[-1] if "#term-" in term_link else term_link
        most_referenced.append({
            "term": term_name,
            "count": count,
            "link": term_link
        })
    glossary_stats["most_referenced_terms"] = most_referenced

    # Write glossary stats to JavaScript file
    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "glossary-stats.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var glossary_stats = {json.dumps(glossary_stats, indent=4)};')
