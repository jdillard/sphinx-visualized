Configuration Values
====================

This page documents all configuration values available in sphinx-visualized.
For installation instructions, see :doc:`getting-started`.
For advanced usage, see :doc:`advanced-configuration`.

.. confval:: visualized_clusters

   - **Type**: list of dictionaries
   - **Default**: ``[]`` (empty list)
   - **Description**: Defines clusters for grouping pages in the link graph visualization.
     See :ref:`configuring_clusters` for detailed usage examples.

   .. versionadded:: 0.5.0

.. confval:: visualized_auto_cluster

   - **Type**: boolean
   - **Default**: ``False``
   - **Description**: When enabled, automatically clusters pages based on their directory structure.
     See :ref:`auto_clustering` for more details.

   .. versionadded:: 0.6.0

.. confval:: visualized_projects

   - **Type**: list of strings
   - **Default**: ``[]`` (empty list)
   - **Description**: List of external Sphinx projects to integrate into the link graph visualization.
     See :ref:`external_projects` for detailed usage examples.

   .. versionadded:: 0.9.0
