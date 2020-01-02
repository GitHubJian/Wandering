const { info } = require('../../utils')

const defaults = {
  host: '127.0.0.1',
  port: 8080,
  https: false
}

module.exports = (api, options) => {
  api.registerCommand(
    'serve',
    {
      description: 'start development server',
      usage: 'wandering-cli-service serve [options]',
      options: {
        '--open': 'open browser on server start',
        '--copy': 'copy url to clipboard on server start',
        '--mode': 'specify env mode (default: development)',
        '--host': `specify host (default: ${defaults.host})`,
        '--port': `specify port (default: ${defaults.port})`
      }
    },
    async function serve (args) {
      info('Starting development server...')

      const isProduction = process.env.NODE_ENV === 'production'

      const url = require('url')
      const chalk = require('chalk')
      const webpack = require('webpack')
      // const WebpackDevMiddleware = require('webpack-dev-middleware');
      // const WebpackHotMiddleware = require('webpack-hot-middleware');
      // const WebpackDevServer = require('webpack-dev-server')
      const WebpackDevServer = require('../WebpackDevServer')
      const portfinder = require('portfinder')
      const prepareURLs = require('../util/prepareURLs')
      const isAbsoluteUrl = require('../util/isAbsoluteUrl')

      api.chainWebpack(webpackConfig => {
        if (process.env.NODE_ENV === 'development') {
          webpackConfig.devtool('cheap-module-eval-source-map')

          webpackConfig
            .plugin('hmr')
            .use(require('webpack/lib/HotModuleReplacementPlugin'))

          webpackConfig.output.globalObject(
            '(typeof self !== \'undefined\' ? self : this)'
          )

          if (options.devServer.progress !== false) {
            webpackConfig
              .plugin('progress')
              .use(require('webpack/lib/ProgressPlugin'))
          }
        }
      })

      // resolve webpack config
      const webpackConfig = api.resolveWebpackConfig()

      const projectDevServerOptions = Object.assign(
        webpackConfig.devServer || {},
        options.devServer
      )

      // resolve server options
      const useHttps =
        args.https || projectDevServerOptions.https || defaults.https
      const protocol = useHttps ? 'https' : 'http'
      const host =
        args.host ||
        process.env.HOST ||
        projectDevServerOptions.host ||
        defaults.host
      portfinder.basePort =
        args.port ||
        process.env.PORT ||
        projectDevServerOptions.port ||
        defaults.port
      const port = await portfinder.getPortPromise()

      const urls = prepareURLs(
        protocol,
        host,
        port,
        isAbsoluteUrl(options.publicPath) ? '/' : options.publicPath
      )

      if (!isProduction) {
        const devClients = [
          'webpack-hot-middleware/client?path=/__webpack_hmr&timeout=2000&reload=true'
        ]
        // inject dev/hot client
        addDevClientToEntry(webpackConfig, devClients)
      }
      // create compiler
      const compiler = webpack(webpackConfig)

      // create server
      const server = new WebpackDevServer(compiler, {
        publicPath: webpackConfig.output.publicPath,
        stats: webpackConfig.stats
      })

      return new Promise((resolve, reject) => {
        // let isFirstCompile = true
        compiler.hooks.done.tap('wandering-cli-service serve', stats => {
          if (stats.hasErrors()) {
            return
          }

          resolve({
            server,
            url: localUrlForBrowser
          })
        })

        server.listen(port, host, err => {
          if (err) {
            reject(err)
          }
        })
      })
    }
  )
}

function addDevClientToEntry (config, devClient) {
  const { entry } = config
  if (typeof entry === 'object' && !Array.isArray(entry)) {
    Object.keys(entry).forEach(key => {
      entry[key] = devClient.concat(entry[key])
    })
  } else if (typeof entry === 'function') {
    config.entry = entry(devClient)
  } else {
    config.entry = devClient.concat(entry)
  }
}
