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

1. **Link Graph** - Interactive graph visualization using sigma.js with search and zoom controls
2. **Toctree Graph** - Hierarchical visualization of your documentation's table of contents structure

