const root = process.cwd()
const path = require('path')

const NjkSSRServerPlugin = require('./server-renderer/server-plugin')
const NjkSSRClientPlugin = require('./server-renderer/client-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const HtmlWebpack = require('./server-router/chunks')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: {
    global: path.resolve(root, 'src/global.js'),
    'pages/1': path.resolve(root, 'src/pages/1/app.js')
  },
  output: {
    filename: 'js/[name].js',
    path: path.resolve(root, 'static')
  },
  resolve: {
    alias: {
      '@': path.resolve(root, 'src')
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader'
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader
          },
          'css-loader'
        ]
      }
    ]
  },
  plugins: [
    new NjkSSRClientPlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CleanWebpackPlugin(),
    
  ]
}
