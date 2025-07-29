const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const fs = require('fs');

// Helper to create vanilla JS files
function createVanillaFiles() {
  return {
    apply: (compiler) => {
      compiler.hooks.afterEmit.tap('CreateVanillaFiles', (compilation) => {
        // Ensure vanilla directory exists
        const vanillaDir = path.resolve(__dirname, 'dist/vanilla');
        if (!fs.existsSync(vanillaDir)) {
          fs.mkdirSync(vanillaDir, { recursive: true });
        }

        // Copy and process each feature file
        const features = ['json-schema-validation', 'query-language'];
        features.forEach(feature => {
          const srcPath = path.resolve(__dirname, `src/features/${feature}/index.js`);
          const destPath = path.resolve(vanillaDir, `${feature}.js`);
          
          // Read the source file and its dependencies
          let content = fs.readFileSync(srcPath, 'utf8');
          
          // Add a banner comment
          const banner = `/**
 * @license
 * ${feature} feature for Awesome Editor
 * (c) 2025 Awesome Editor Contributors
 * Released under the MIT License
 */\n\n`;
          
          fs.writeFileSync(destPath, banner + content);
        });
      });
    }
  };
}

// Common configuration
const commonConfig = {
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
    }),
    createVanillaFiles() // Add createVanillaFiles to common plugins
  ]
};

// Production (minimized) configuration
const productionConfig = {
  ...commonConfig,
  name: 'production',
  mode: 'production',
  entry: {
    'json-schema-validation': './src/features/json-schema-validation/index.js',
    'query-language': './src/features/query-language/index.js'
  },
  output: {
    filename: '[name].min.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'umd',
    library: ['awesomeEditor', '[name]'],
    globalObject: 'this',
    clean: {
      keep: /vanilla\// // Keep the vanilla directory during clean
    }
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        format: {
          comments: /^!/
        }
      },
      extractComments: true
    })]
  }
};

// Development (non-minimized) configuration
const developmentConfig = {
  ...commonConfig,
  name: 'development',
  mode: 'development',
  entry: {
    'json-schema-validation': './src/features/json-schema-validation/index.js',
    'query-language': './src/features/query-language/index.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'umd',
    library: ['awesomeEditor', '[name]'],
    globalObject: 'this'
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'examples')
    },
    hot: true,
    open: true,
    port: 8080
  },
  optimization: {
    minimize: false
  },
  devtool: 'source-map'
};

// Export both configurations
module.exports = [productionConfig, developmentConfig];
