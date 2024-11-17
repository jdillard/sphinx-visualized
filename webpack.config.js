const path = require('path');

module.exports = {
  mode: 'production',
  entry: './sigma_src/index.js',
  output: {
    filename: 'sigma-graph.js',
    path: path.resolve(__dirname, 'sphinx_visualized', 'static', 'js'),
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.json'],
  }
};

