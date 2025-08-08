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
        const features = ['json-schema-validation', 'query-language', 'smart-table'];
        features.forEach(feature => {
          const srcPath = path.resolve(__dirname, `src/features/${feature}/index.js`);
          const destPath = path.resolve(vanillaDir, `${feature}.js`);
          
          // Read the source file and its dependencies
          // Function to process and order dependencies
          const processFile = (filePath) => {
            let content = fs.readFileSync(filePath, 'utf8');
            // Remove imports and exports
            content = content
              .replace(/import.*?;[\n\r]*/g, '')
              .replace(/export\s*{[^}]*}/g, '')
              .replace(/export\s+/g, '')
              .replace(/from\s+['"].*?['"];?[\n\r]*/g, '')  // Remove 'from' statements
              .trim();
            return content;
          };

          let content = '';
          
          // For json-schema-validation, include all dependencies in correct order
          if (feature === 'json-schema-validation') {
            const baseDir = path.resolve(__dirname, 'src/features/json-schema-validation');
            const files = [
              'parser.js',
              'token-validator.js',
              'completion.js',
              'hover.js',
              'index.js'
            ];
            files.forEach(file => {
              content += processFile(path.join(baseDir, file)) + '\n\n';
            });
          } else {
            // For other features, just process the main file
            content = processFile(srcPath);
          }
          
          // Wrap in IIFE
          content = `(function(monaco) {
            if (typeof monaco === 'undefined') {
              console.error('Monaco Editor must be loaded before the ${feature} feature');
              return;
            }

            ${content}

            // Expose feature to global scope
            window.awesomeEditor = window.awesomeEditor || {};
            window.awesomeEditor['${feature}'] = {
              ${feature === 'json-schema-validation' ? 'setupJsonValidation, setupHoverProvider' :
                feature === 'query-language' ? 'setupQueryLanguage' :
                feature === 'smart-table' ? 'setupSmartTable' : ''}
            };
          })(window.monaco);\n`;

          // Add a banner comment with feature description
          const descriptions = {
            'json-schema-validation': 'Adds JSON Schema validation, completion, and hover features to Monaco Editor',
            'query-language': 'Adds custom query language support with syntax highlighting and completion',
            'smart-table': 'Adds table filtering capabilities using a query language'
          };

          const banner = `/**
 * @license
 * ${feature} feature for Awesome Editor
 * ${descriptions[feature] || ''}
 * 
 * @version 0.1.1
 * @copyright (c) 2025 Awesome Editor Contributors
 * @license MIT License
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
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
      '@features': path.resolve(__dirname, 'src/features')
    }
  },
  plugins: [
    createVanillaFiles(), // Add createVanillaFiles to common plugins
    new MonacoWebpackPlugin({
      languages: ['json', 'javascript'],
      features: ['!gotoSymbol']
    })
  ]
};

// Production (minimized) configuration
const productionConfig = {
  ...commonConfig,
  name: 'production',
  mode: 'production',
  entry: {
    'json-schema-validation': './src/features/json-schema-validation/index.js',
    'query-language': './src/features/query-language/index.js',
    'smart-table': './src/features/smart-table/index.js'
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
    'query-language': './src/features/query-language/index.js',
    'smart-table': './src/features/smart-table/index.js'
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
