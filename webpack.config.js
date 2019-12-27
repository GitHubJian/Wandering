const root = process.cwd()
const path = require('path')

const NjkSSRServerPlugin = require('./server-renderer/server-plugin')
const NjkSSRClientPlugin = require('./server-renderer/client-plugin')

module.exports = {
  entry: {
    global: path.resolve(root, 'src/global.js'),
    'pages/1': path.resolve(root, 'src/pages/1/app.js')
  },
  output: {
    filename: 'js/[name].js',
    path: path.resolve(root, 'static')
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
      }
    ]
  },
  plugins: [
    new NjkSSRClientPlugin(),
    new NjkSSRServerPlugin(),
  ]
}
