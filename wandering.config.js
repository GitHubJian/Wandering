const NjkSSRClientPlugin = require('./server-renderer/client-plugin')
const NjkSSRServerPlugin = require('./server-renderer/server-plugin')

module.exports = {
  publicPath: '/',
  outputDir: 'static',
  assetsDir: '',
  indexPath: 'index.html',
  filenameHashing: true,
  pages: {
    global: {
      entry: 'src/global.js'
    },
    'pages/1': {
      entry: 'src/pages/1/app.js'
    }
  },
  chainWebpack: function (config) {
    for (var [key] of config.plugins.store) {
      if (
        ['preload', 'prefetch', 'html'].some(v => {
          return key.startsWith(v)
        })
      ) {
        config.plugins.delete(key)
      }
    }

    config.plugin('njk-server-plugin').use(NjkSSRServerPlugin)
    config.plugin('njk-client-plugin').use(NjkSSRClientPlugin)
  }
}
