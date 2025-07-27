const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
  entry: {
    'json-schema-validation': './src/features/json-schema-validation/index.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'umd',
    library: ['awesomeEditor', '[name]'],
    globalObject: 'this',
    clean: true
  },
  externals: {
    'monaco-editor': {
      commonjs: 'monaco-editor',
      commonjs2: 'monaco-editor',
      amd: 'monaco-editor',
      root: 'monaco'
    }
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new MonacoWebpackPlugin({
      languages: ['json']
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'examples')
    },
    hot: true,
    open: true,
    port: 8080
  },
  mode: 'production'
};
