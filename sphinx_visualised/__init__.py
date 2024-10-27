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

__version__ = "0.3.0"


def setup(app):
    app.connect("builder-inited", create_objects)
    app.connect("doctree-resolved", get_links)
    app.connect("build-finished", create_json)

    return {
        "version": __version__,
        "parallel_read_safe": False,
        "parallel_write_safe": True,
    }


def create_objects(app):
    """
    Create objects when builder is initiated
    """
    builder = getattr(app, "builder", None)
    if builder is None:
        return
    builder.env.app.nodes = [] # a list of nodes and their metadata
    builder.env.app.links = [] # a list of links between pages
    builder.env.app.pages = [] # an index of page names
    builder.env.app.groups = [] # an index of page groups


def get_links(app, doctree, docname):
    """
    Gather internal link connections
    """
    references = [] # a list of every internal reference made between pages

    #TODO handle troctree entries?
    #TODO get targets
    # for node in doctree.traverse(sphinx.addnodes.toctree):
    #     print(vars(node))

    for node in doctree.traverse(docutils_nodes.reference):
        # add internal references
        if node.tagname == 'reference' and node.get('internal') and node.get('refuri'):
            # calulate path of the referenced page in relation to docname
            ref = node.attributes['refuri'].split("#")[0]
            absolute_ref = os.path.abspath(os.path.join(os.path.dirname(f"/{docname}.html"), ref))[1:-5]

            #TODO some how get ref/doc/term for type?
            # add each link as an individual reference
            references.append((f"/{docname}.html", f"/{absolute_ref}.html", "ref"))

            #TODO turn to function
            # a group is the name of the top level directory
            docname_group = f"/{docname}.html".split('/')[1]
            if not docname_group in app.env.app.groups:
                app.env.app.groups.append(docname_group)

            absolute_ref_group = f"/{absolute_ref}.html".split('/')[1]
            if not absolute_ref_group in app.env.app.groups:
                app.env.app.groups.append(absolute_ref_group)

            # add to index of page names
            if not f"/{docname}.html" in app.env.app.pages:
                app.env.app.pages.append(f"/{docname}.html")

            if not f"/{absolute_ref}.html" in app.env.app.pages:
                app.env.app.pages.append(f"/{absolute_ref}.html")

            # check if node exists based on docname's id
            if not any(d.get("id") == app.env.app.pages.index(f"/{docname}.html") for d in app.env.app.nodes):
                if app.env.titles.get(docname):
                    title = app.env.titles.get(docname).astext()
                else:
                    title = f"/{docname}.html"

                app.env.app.nodes.append({
                    "id": app.env.app.pages.index(f"/{docname}.html"),
                    "group": app.env.app.groups.index(docname_group),
                    "label": title,
                    "path": f"../../../{docname}.html",
                    "level": 1
                })

            # check if node exists based on absolute_ref's id
            if not any(d.get("id") == app.env.app.pages.index(f"/{absolute_ref}.html") for d in app.env.app.nodes):
                if app.env.titles.get(absolute_ref):
                    title = app.env.titles.get(absolute_ref).astext()
                else:
                    title = f"/{absolute_ref}.html"

                app.env.app.nodes.append({
                    "id": app.env.app.pages.index(f"/{absolute_ref}.html"),
                    "group": app.env.app.groups.index(absolute_ref_group),
                    "label": title,
                    "path": f"../../../{absolute_ref}.html",
                    "level": 1
                })

    # create object that links references between pages
    references_counts = Counter(references)
    for ref, count in references_counts.items():
        #TODO check if unique else strength++
        app.env.app.links.append({
            "target": app.env.app.pages.index(ref[1]),
            "source": app.env.app.pages.index(ref[0]),
            "strength": 1,
            "type": ref[2],
        })


def build_toctree_hierarchy(app):
    """
    Take toctree_includes and build the hierarchy while gathering page metadata.
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


def create_json(app, exception):
    """
    Create and copy static files for visualizations
    """
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

    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "links.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var links_data = {json.dumps(app.env.app.links, indent=4)};')

    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "nodes.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var nodes_data = {json.dumps(app.env.app.nodes, indent=4)};')

    filename = Path(app.outdir) / "_static" / "sphinx-visualized" / "js" / "toctree.js"
    with open(filename, "w") as json_file:
        json_file.write(f'var toctree = {json.dumps(build_toctree_hierarchy(app), indent=4)};')
