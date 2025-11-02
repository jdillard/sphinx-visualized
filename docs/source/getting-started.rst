Getting started
===============

Installing
----------

Directly install via pip by using:

.. code-block::

   pip install sphinx-visualized

Add ``sphinx_visualized`` to the `extensions <https://www.sphinx-doc.org/en/master/usage/configuration.html#confval-extensions>`_ array in your Sphinx **conf.py**.
For example:

.. code-block:: python

   extensions = ['sphinx_visualized']

Usage
-----

After building the docs, view by opening the following page:

- ``/_static/sphinx-visualized/index.html``

.. note:: You can see generated examples of each page in :doc:`example/index`. Also check out :doc:`example/lorem` for a detailed example.

Visualization Options
---------------------

sphinx-visualized provides three different visualization options:

1. **D3.js Link Graph** - Force-directed graph visualization using D3.js showing internal document references
2. **Toctree Graph** - Hierarchical visualization of your documentation's table of contents structure
3. **Sigma.js Graph** - Interactive graph visualization using sigma.js with search and zoom controls

GraphSON Export
---------------

The extension automatically generates a GraphSON format file compatible with Apache TinkerPop and graph analysis tools:

- ``/_static/sphinx-visualized/graphson.json``

This file can be used with:

- Apache TinkerPop graph computing framework
- Graph analysis and visualization tools
- Custom graph processing applications

The GraphSON format includes:

- **Vertices**: Documentation pages with properties (name, path)
- **Edges**: Internal references between pages with properties (strength, type)
