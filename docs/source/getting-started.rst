Getting started
===============

Installing
----------

Directly install via pip by using:

.. code-block::

   pip install sphinx-visualized

Add ``sphinx_visualized`` to the :confval:`extensions <sphinx:extensions>` array in your Sphinx **conf.py**.

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

sphinx-visualized provides four different visualization options:

1. **Statistics** - Statistical overview of your documentation
2. **Link Graph** - Interactive graph visualization of hyperlinks
3. **Toctree Graph** - Hierarchical visualization of your documentation's table of contents structure
4. **Includes Graph** - Visualization of file inclusion relationships showing which documents include other files

