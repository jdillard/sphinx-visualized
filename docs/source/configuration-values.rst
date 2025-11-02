Configuration Values
====================

This page documents all configuration values available in sphinx-visualized.

.. confval:: visualized_clusters

   - **Type**: list of dictionaries
   - **Default**: ``[]`` (empty list)
   - **Description**: Defines clusters for grouping and color-coding pages in the link graph visualization.
     Each cluster is a dictionary with ``name`` and ``patterns`` keys.
     See :ref:`configuring_clusters`.

   **Cluster Dictionary Keys**:

   - ``name`` (string, required): Display name for the cluster shown in the legend
   - ``patterns`` (list of strings, required): Glob patterns to match page paths

   **Pattern Matching**:

   - Patterns use standard glob syntax (``*``, ``**``, ``?``)
   - Paths are matched without leading ``/`` or trailing ``.html``
   - First matching pattern wins if a page matches multiple clusters
   - Pages without matches use the default color

   .. versionadded:: 0.5.0
