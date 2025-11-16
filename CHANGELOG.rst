Changelog
=========

0.8.2
-----

- Increase the zoom out limit for the toctree graph 

0.8.1
-----

- Make mobile friendly
- Use full relative path (from root) for include files
- Fix TypeError with mixed Path and string types for Python 3.12 compatibility
- Fix AttributeError when title is missing in toctrees
- Fix KeyError during failed builds when accessing root_doc
- Add Column Spacing slider to toctree graph

0.8.0
-----

- Add Glossary stats
- Add support for link types to link graph
- Add header navigation

0.7.0
-----

- Add includes graph and statistics
- Improve toctree graph to match other graphs
- Use Tailwinds CSS for styling

0.6.0
-----

- Add support for intersphinx links
- Add support for auto cluster naming with :confval:`visualized_auto_cluster`
- Add Statistics page

0.5.0
-----

- Replace custom link graph with sigma.js implementation

0.4.0
-----

- Add parallel support

0.3.0
-----

- Make toctree graph collapsible
- Show the reference directionality in link graph
- Consolidate files to single location
- Support older versions of sphinx.util.fileutil.copy_asset()
- Rename extension to ``sphinx-visualized``

0.2.3
-----

- Fix absolute_ref syntax so page titles are looked up correctly

0.2.2
-----

- Change json to js for data files

0.2.1
-----

- Fix MANIFEST

0.2.0
-----

- Rename extension to ``sphinx-visualised``
- Add toctree graph

0.1.0
-----

- Initial release

