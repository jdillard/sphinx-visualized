const data = {
  'development/index': ['development/overview', 'development/tutorials/index', 'development/builders', 'development/templating', 'development/theming'],
  'development/tutorials/index': ['development/tutorials/helloworld', 'development/tutorials/todo', 'development/tutorials/recipe', 'development/tutorials/autodoc_ext'],
  'extdev/index': ['extdev/appapi', 'extdev/projectapi', 'extdev/envapi', 'extdev/builderapi', 'extdev/collectorapi', 'extdev/markupapi', 'extdev/domainapi', 'extdev/parserapi', 'extdev/nodes', 'extdev/logging', 'extdev/i18n', 'extdev/utils', 'extdev/deprecated'],
  'index': ['usage/quickstart', 'usage/installation', 'tutorial/index', 'usage/index', 'development/index', 'latex', 'extdev/index', 'support', 'internals/index', 'faq', 'authors', 'man/index', 'usage/configuration', 'usage/extensions/index', 'usage/restructuredtext/index', 'glossary', 'changes', 'examples'],
  'internals/index': ['internals/contributing', 'internals/release-process', 'internals/organization', 'internals/code-of-conduct'],
  'man/index': ['man/sphinx-quickstart', 'man/sphinx-build', 'man/sphinx-apidoc', 'man/sphinx-autogen'],
  'tutorial/index': ['tutorial/getting-started', 'tutorial/first-steps', 'tutorial/more-sphinx-customization', 'tutorial/narrative-documentation', 'tutorial/describing-code', 'tutorial/automatic-doc-generation', 'tutorial/deploying', 'tutorial/end'],
  'usage/advanced/websupport/index': ['usage/advanced/websupport/quickstart', 'usage/advanced/websupport/api', 'usage/advanced/websupport/searchadapters', 'usage/advanced/websupport/storagebackends'],
  'usage/domains/index': ['usage/domains/standard', 'usage/domains/c', 'usage/domains/cpp', 'usage/domains/javascript', 'usage/domains/mathematics', 'usage/domains/python', 'usage/domains/restructuredtext'],
  'usage/extensions/index': ['usage/extensions/autodoc', 'usage/extensions/autosectionlabel', 'usage/extensions/autosummary', 'usage/extensions/coverage', 'usage/extensions/doctest', 'usage/extensions/duration', 'usage/extensions/extlinks', 'usage/extensions/githubpages', 'usage/extensions/graphviz', 'usage/extensions/ifconfig', 'usage/extensions/imgconverter', 'usage/extensions/inheritance', 'usage/extensions/intersphinx', 'usage/extensions/linkcode', 'usage/extensions/math', 'usage/extensions/napoleon', 'usage/extensions/todo', 'usage/extensions/viewcode'],
  'usage/index': ['usage/restructuredtext/index', 'usage/markdown', 'usage/referencing', 'usage/configuration', 'usage/builders/index', 'usage/domains/index', 'usage/extensions/index', 'usage/theming', 'usage/advanced/intl', 'usage/advanced/websupport/index'],
  'usage/restructuredtext/index': ['usage/restructuredtext/basics', 'usage/restructuredtext/roles', 'usage/restructuredtext/directives', 'usage/restructuredtext/field-lists', 'usage/restructuredtext/domains']
};

function buildHierarchy(data) {
  const root = { name: 'root', children: [] };
  const nodeMap = {};

  Object.keys(data).forEach(parent => {
    if (!nodeMap[parent]) {
      nodeMap[parent] = { name: parent, children: [] };
    }

    data[parent].forEach(child => {
      if (!nodeMap[child]) {
        nodeMap[child] = { name: child, children: [] };
      }
      nodeMap[parent].children.push(nodeMap[child]);
    });
  });

  // Assuming 'index' is the root node
  root.children.push(nodeMap['index']);
  return root;
}

const treeData = buildHierarchy(data);

