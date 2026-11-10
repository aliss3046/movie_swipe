const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin'); 
const { resolve } = require('dns');

module.exports = {
    entry: "./src/index.jsx",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js",
        clean: true,
    },
    resolve: {
        extensions: [".js", '.jsx'],
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            "@babel/preset-env",
                            ["@babel/preset-react", {runtime: "automatic", development: false,}],
                        ],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ["style-loader", 'css-loader'],
            },
        ],
    },

    plugins: [
    new HtmlWebpackPlugin({
        template: './src/index.html',
        favicon: "./public/icon.png",
        }),
    ],

    devServer: {
        static: {
            directory: path.resolve(__dirname, 'src'),
        },

        proxy: [
            {
                context: ['/api'],
                target: 'http://127.0.0.1:3001',
            },
        ],

        port: 3000,
        open: true,
        host: "0.0.0.0",
        allowedHosts: ["legal-dryers-fall.loca.lt"],
    },
};

