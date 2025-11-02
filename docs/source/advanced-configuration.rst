Advanced Configuration
======================

This page covers advanced configuration options for the sphinx-visualized extension. For basic setup, see :doc:`getting-started`.

.. _configuring_clusters:

Configuring Link Clusters
^^^^^^^^^^^^^^^^^^^^^^^^^

Clusters allow you to group pages in the link graph visualization based on glob patterns.

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
- **First match wins**: If a page matches multiple patterns, it's assigned to the first matching cluster
- **Unclustered pages**: Pages that don't match any pattern use the default color

