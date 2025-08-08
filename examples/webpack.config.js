const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

// Make all paths absolute for consistency
const examplesDir = __dirname;
const rootDir = path.resolve(examplesDir, '..');

module.exports = {
    resolve: {
        fallback: {
            path: false,
            fs: false
        },
        alias: {
            'monaco-editor': path.resolve(rootDir, 'node_modules/monaco-editor'),
            '@src': path.resolve(rootDir, 'src'),
            '@features': path.resolve(rootDir, 'src/features')
        }
    },
    entry: {
        'json-schema-validation': path.resolve(__dirname, 'json-schema-validation/index.js'),
        'query-language': path.resolve(__dirname, 'query-language/index.js'),
        'smart-table': path.resolve(__dirname, 'smart-table/index.js')
    },
    output: {
        filename: '[name]/index.js',
        path: path.resolve(__dirname, 'dist/examples'),
        clean: true
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
            languages: ['json', 'javascript'],
            features: ['!gotoSymbol']
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'json-schema-validation/index.html'),
            filename: 'json-schema-validation/index.html',
            chunks: ['json-schema-validation']
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'smart-table/index.html'),
            filename: 'smart-table/index.html',
            chunks: ['smart-table']
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'query-language/index.html'),
            filename: 'query-language/index.html',
            chunks: ['query-language']
        })
    ],
    devServer: {
        static: [
            {
                directory: path.join(__dirname, '../examples'),
                publicPath: '/',
                watch: {
                    ignored: /node_modules|dist|\.git/
                }
            },
            {
                directory: path.join(__dirname, '../src'),
                publicPath: '/src',
                watch: {
                    ignored: /node_modules|dist|\.git/
                }
            }
        ],
        hot: true,
        open: {
            target: ['/query-language/'],
            app: {
                name: process.platform === 'darwin' ? 'google chrome' : 'chrome'
            }
        },
        devMiddleware: {
            publicPath: '/'
        }
    }
};
