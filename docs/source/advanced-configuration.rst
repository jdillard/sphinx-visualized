Advanced Configuration
======================

This page covers advanced configuration options for the sphinx-visualized extension.
For basic setup, see :doc:`getting-started`.

.. _configuring_clusters:

Configuring Link Clusters
^^^^^^^^^^^^^^^^^^^^^^^^^

Clusters allow you to group pages in the link graph visualization based on glob patterns or directory structure. Pages in the same cluster are colored identically in the visualization, making it easy to understand the organization of your documentation.

.. _basic_cluster_setup:

Basic Cluster Setup
~~~~~~~~~~~~~~~~~~~

Add cluster configuration to your ``conf.py``:

.. code-block:: python

   visualized_clusters = [
       {
           "name": "Getting Started",
           "patterns": ["index", "getting-started"]
       },
       {
           "name": "API Documentation",
           "patterns": ["api/*"]
       },
       {
           "name": "Examples",
           "patterns": ["tutorials/*", "examples/*"]
       }
   ]

Each cluster requires:

- **name** (required): Display name shown in the cluster legend
- **patterns** (required): List of glob patterns to match page paths

.. _pattern_matching:

Pattern Matching
~~~~~~~~~~~~~~~~

Patterns use standard glob syntax to match page paths:

- **Exact match**: ``"index"`` matches only the index page
- **Wildcard**: ``"api/*"`` matches all direct children of the api directory
- **Recursive**: ``"docs/**/*"`` matches all pages under docs recursively
- **First match wins**: If a page matches multiple patterns across different clusters, it's assigned to the first matching cluster
- **Unclustered pages**: Pages that don't match any pattern use the default color

.. _auto_clustering:

Automatic Clustering
~~~~~~~~~~~~~~~~~~~~

For projects with a clear directory structure, you can enable automatic clustering instead of manually defining patterns:

.. code-block:: python

   visualized_auto_cluster = True

With auto-clustering enabled:

- Pages in subdirectories are automatically grouped by their first directory component
- For example, ``tutorials/intro.html`` and ``tutorials/advanced.html`` both get assigned to a cluster named "tutorials"
- Root-level pages (like ``index.html``) remain unclustered
- You can combine auto-clustering with manual clusters - manual patterns take precedence

.. _external_projects:

Integrating External Projects
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Integrate documentation from other Sphinx projects that also use the **sphinx-visualized** extension:

.. code-block:: python

   intersphinx_mapping = {
       "sphinx": ("https://www.sphinx-doc.org/en/master/", None),
       "python": ("https://docs.python.org/3/", None),
   }

   visualized_projects = ['sphinx']

.. note:: Each project name must match an entry in your :confval:`intersphinx_mapping`.

GraphSON Export
^^^^^^^^^^^^^^^

The extension automatically generates a GraphSON v3.0 format file compatible with Apache TinkerPop and graph analysis tools:

- ``/_static/sphinx-visualized/graphson.json``


**Use Cases**:

- Import into Apache TinkerPop for advanced graph queries
- Analyze documentation structure with graph algorithms
- Custom visualization with other graph libraries
- Integration with graph databases
- Documentation metrics and analytics

