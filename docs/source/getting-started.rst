Getting started
===============

Installing
----------

Directly install via pip by using:

.. code-block::

   pip install sphinx-visualised

Add ``sphinx_visualised`` to the `extensions <https://www.sphinx-doc.org/en/master/usage/configuration.html#confval-extensions>`_ array in your Sphinx **conf.py**.
For example:

.. code-block:: python

   extensions = ['sphinx_visualised']

Usage
-----

After building the docs, open the following pages in the browser:

- ``/_static/link-graph.html``
- ``/_static/toctree-graph.html``

.. note:: You can see generated examples of each page in :doc:`example/index`.
