const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = {
    entry: {
        'json-schema-validation': './examples/json-schema-validation/index.js',
        'query-language': './examples/query-language/index.js'
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
            languages: ['json', 'javascript', 'typescript', 'html', 'css']
        }),
        new HtmlWebpackPlugin({
            template: './examples/json-schema-validation/index.html',
            filename: 'json-schema-validation/index.html',
            chunks: ['json-schema-validation']
        }),
        new HtmlWebpackPlugin({
            template: './examples/query-language/index.html',
            filename: 'query-language/index.html',
            chunks: ['query-language']
        })
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, '../'),
            publicPath: '/',
            serveIndex: true,
            watch: true
        },
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
