#!/usr/bin/env python3
# -*- coding: utf-8 -*-


import json
import sphinx
from packaging import version
import os
import shutil
from collections import Counter
from pathlib import Path
from docutils import nodes as docutils_nodes
from multiprocessing import Manager, Queue
from fnmatch import fnmatch

__version__ = "0.6.0"


def setup(app):
    app.add_config_value("visualized_clusters", [], "html")
    app.connect("builder-inited", create_objects)
    app.connect("doctree-resolved", get_links)
    app.connect("build-finished", create_json)

    return {
        "version": __version__,
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }


def get_page_cluster(page_path, clusters_config):
    """
    Determine which cluster a page belongs to based on glob patterns.

    Args:
        page_path: Path to the page (e.g., "/example/lorem.html")
        clusters_config: List of cluster configurations from conf.py

    Returns:
        Cluster name if matched, None otherwise
    """
    # Remove leading slash and .html extension for pattern matching
    normalized_path = page_path.lstrip('/').rstrip('.html')

    for cluster in clusters_config:
        name = cluster.get('name')
        patterns = cluster.get('patterns', [])

        for pattern in patterns:
            if fnmatch(normalized_path, pattern):
                return name

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

                #TODO some how get ref/doc/term for type?
                # add each link as an individual reference
                app.env.app.references.put((f"/{docname}.html", f"/{refname}.html", "ref"))

                docname_page = f"/{docname}.html"
                app.env.app.pages[docname_page] = True

                refname_page = f"/{refname}.html"
                app.env.app.pages[refname_page] = True

            # Handle external references (only intersphinx links)
            else:
                # Extract domain/URL for external links
                external_url = refuri.split("#")[0]  # Remove fragment

                # Only capture intersphinx links, skip regular external links
                project_name = get_intersphinx_project(app, external_url)
                if project_name:
                    # Store intersphinx link with project name and URL
                    target_key = f"external:{project_name}:{external_url}"
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
                node_map[child] = {
                    "id": child,
                    "label": app.env.titles.get(child).astext(),
                    "path": f"../../../{child}.html",
                    "children": [],
                }
            node_map[key]["children"].append(node_map[child])

    return node_map[app.builder.config.root_doc]


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
                "reference_count": link.get("reference_count", 1)
            }
        }
        edges.append(edge)

    # Include cluster configuration metadata
    graphson = {
        "vertices": vertices,
        "edges": edges
    }

    if clusters_config:
        graphson["clusters"] = clusters_config

    return graphson


def create_json(app, exception):
    """
    Create and copy static files for visualizations
    """
    page_list = list(app.env.app.pages.keys()) # list of pages with references
    clusters_config = app.config.visualized_clusters

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
        # Check if this is an intersphinx link (format: "external:project_name:URL")
        if page.startswith("external:"):
            # Parse the format "external:project_name:URL"
            parts = page.split(":", 2)  # Split into at most 3 parts
            if len(parts) >= 3:
                project_name = parts[1]
                url = parts[2]
            else:
                # Fallback for old format "external:URL"
                url = page[9:]
                from urllib.parse import urlparse
                parsed = urlparse(url)
                project_name = parsed.netloc or url

            nodes.append({
                "id": page_list.index(page),
                "label": project_name,  # Use project name instead of domain
                "path": url,  # Use full URL as path
                "cluster": None,  # Intersphinx links don't belong to clusters
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
            cluster = get_page_cluster(page, clusters_config)

            nodes.append({
                "id": page_list.index(page),
                "label": title,
                "path": f"../../..{page}",
                "cluster": cluster,
            })

    # create object that links references between pages
    links = [] # a list of links between pages
    references_counts = Counter(reference_list)
    for ref, count in references_counts.items():
        links.append({
            "target": page_list.index(ref[1]),
            "source": page_list.index(ref[0]),
            "strength": 1,
            "reference_count": count,
            "type": ref[2],
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
