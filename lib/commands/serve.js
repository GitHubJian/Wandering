const { info } = require('../../utils')

module.exports = (api, options) => {
  api.registerCommand(
    'serve',
    {
      description: 'start development server',
      usage: 'vue-cli-service serve [options] [entry]',
      options: {
        '--open': `open browser on server start`,
        '--copy': `copy url to clipboard on server start`,
        '--mode': `specify env mode (default: development)`,
        '--host': `specify host (default: ${defaults.host})`,
        '--port': `specify port (default: ${defaults.port})`,
        '--https': `use https (default: ${defaults.https})`,
        '--public': `specify the public network URL for the HMR client`,
        '--skip-plugins': `comma-separated list of plugin names to skip for this run`
      }
    },
    async function serve(args) {
      info('Starting development server...')

      const isProduction = process.env.NODE_ENV === 'production'

      const url = require('url')
      const chalk = require('chalk')
      const webpack = require('webpack')
      const WebpackDevServer = require('webpack-dev-server')
      const portfinder = require('portfinder')
      const prepareURLs = require('../util/prepareURLs')
      const prepareProxy = require('../util/prepareProxy')
      const launchEditorMiddleware = require('launch-editor-middleware')
      const isAbsoluteUrl = require('../util/isAbsoluteUrl')

      // configs that only matters for dev server
      api.chainWebpack(webpackConfig => {
        if (process.env.NODE_ENV === 'development') {
          webpackConfig.devtool('cheap-module-eval-source-map')

          webpackConfig
            .plugin('hmr')
            .use(require('webpack/lib/HotModuleReplacementPlugin'))

          webpackConfig.output.globalObject(
            `(typeof self !== 'undefined' ? self : this)`
          )

          if (options.devServer.progress !== false) {
            webpackConfig
              .plugin('progress')
              .use(require('webpack/lib/ProgressPlugin'))
          }
        }
      })

      const webpackConfig = api.resolveWebpackConfig()

      const projectDevServerOptions = Object.assign(
        webpackConfig.devServer || {},
        options.devServer
      )

      if (args.dashboard) {
        const DashboardPlugin = require('../webpack/DashboardPlugin')
        webpackConfig.plugin = webpackConfig.plugin || []
        webpackConfig.plugin.push(new DashboardPlugin({ type: 'serve' }))
      }

      const entry = args._[0]
      if (entry) {
        webpackConfig.entry = {
          app: api.resolve(entry)
        }
      }

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
      const rawPublicUrl = args.public || projectDevServerOptions.public
      const publicUrl = rawPublicUrl
        ? /^[a-zA-Z]+:\/\//.test(rawPublicUrl)
          ? rawPublicUrl
          : `${protocol}://${rawPublicUrl}`
        : null

      const urls = prepareURLs(
        protocol,
        host,
        port,
        isAbsoluteUrl(options.publicPath) ? '/' : options.publicPath
      )
      const localUrlForBrowser = publicUrl || urls.localUrlForBrowser
      const proxySettings = prepareProxy(
        projectDevServerOptions.proxy,
        api.resolve('public')
      )

      // inject dev & hot-reload middleware entries
      if (!isProduction) {
        const sockjsUrl = publicUrl
          ? // explicitly configured via devServer.public
            `?${publicUrl}/sockjs-node`
          : isInContainer
          ? // can't infer public network url if inside a container...
            // use client-side inference (note this would break with non-root publicPath)
            ``
          : // otherwise infer the url
            `?` +
            url.format({
              protocol,
              port,
              hostname: urls.lanUrlForConfig || 'localhost',
              pathname: '/sockjs-node'
            })
        const devClients = [
          // dev server client
          require.resolve(`webpack-dev-server/client`) + sockjsUrl,
          // hmr client
          require.resolve(
            projectDevServerOptions.hotOnly
              ? 'webpack/hot/only-dev-server'
              : 'webpack/hot/dev-server'
          )
        ]
        if (process.env.APPVEYOR) {
          devClients.push(`webpack/hot/poll?500`)
        }
        // inject dev/hot client
        addDevClientToEntry(webpackConfig, devClients)
      }

      // create compiler
      const compiler = webpack(webpackConfig)
      // create server
      const server = new WebpackDevServer(
        compiler,
        Object.assign(
          {
            logLevel: 'silent',
            clientLogLevel: 'silent',
            historyApiFallback: {
              disableDotRule: true,
              rewrites: genHistoryApiFallbackRewrites(
                options.publicPath,
                options.pages
              )
            },
            contentBase: api.resolve('public'),
            watchContentBase: !isProduction,
            hot: !isProduction,
            compress: isProduction,
            publicPath: options.publicPath,
            overlay: isProduction // TODO disable this
              ? false
              : { warnings: false, errors: true }
          },
          projectDevServerOptions,
          {
            https: useHttps,
            proxy: proxySettings,
            // eslint-disable-next-line no-shadow
            before(app, server) {
              // launch editor support.
              // this works with vue-devtools & @vue/cli-overlay
              app.use(
                '/__open-in-editor',
                launchEditorMiddleware(() =>
                  console.log(
                    `To specify an editor, specify the EDITOR env variable or ` +
                      `add "editor" field to your Vue project config.\n`
                  )
                )
              )
              // allow other plugins to register middlewares, e.g. PWA
              api.service.devServerConfigFns.forEach(fn => fn(app, server))
              // apply in project middlewares
              projectDevServerOptions.before &&
                projectDevServerOptions.before(app, server)
            },
            // avoid opening browser
            open: false
          }
        )
      )

      return new Promise((resolve, reject) => {
        let isFirstCompile = true
        compiler.hooks.done.tap('wandering-cli-service serve', state => {
          if (stats.hasErrors()) {
            return
          }

          let copied = ''
          if (isFirstCompile && args.copy) {
            try {
              require('clipboardy').writeSync(localUrlForBrowser)
              copied = chalk.dim('(copied to clipboard)')
            } catch (_) {
              /* catch exception if copy to clipboard isn't supported (e.g. WSL), see issue #3476 */
            }
          }

          const networkUrl = publicUrl
            ? publicUrl.replace(/([^/])$/, '$1/')
            : urls.lanUrlForTerminal

          console.log()
          console.log(`  App running at:`)
          console.log(
            `  - Local:   ${chalk.cyan(urls.localUrlForTerminal)} ${copied}`
          )
          if (!isInContainer) {
            console.log(`  - Network: ${chalk.cyan(networkUrl)}`)
          } else {
            console.log()
            console.log(
              chalk.yellow(
                `  It seems you are running Vue CLI inside a container.`
              )
            )
            if (
              !publicUrl &&
              options.publicPath &&
              options.publicPath !== '/'
            ) {
              console.log()
              console.log(
                chalk.yellow(
                  `  Since you are using a non-root publicPath, the hot-reload socket`
                )
              )
              console.log(
                chalk.yellow(
                  `  will not be able to infer the correct URL to connect. You should`
                )
              )
              console.log(
                chalk.yellow(
                  `  explicitly specify the URL via ${chalk.blue(
                    `devServer.public`
                  )}.`
                )
              )
              console.log()
            }
            console.log(
              chalk.yellow(
                `  Access the dev server via ${chalk.cyan(
                  `${protocol}://localhost:<your container's external mapped port>${options.publicPath}`
                )}`
              )
            )
          }
          console.log()

          if (isFirstCompile) {
            isFirstCompile = false

            if (!isProduction) {
              const buildCommand = hasProjectYarn(api.getCwd())
                ? `yarn build`
                : hasProjectPnpm(api.getCwd())
                ? `pnpm run build`
                : `npm run build`
              console.log(`  Note that the development build is not optimized.`)
              console.log(
                `  To create a production build, run ${chalk.cyan(
                  buildCommand
                )}.`
              )
            } else {
              console.log(`  App is served in production mode.`)
              console.log(`  Note this is for preview or E2E testing only.`)
            }
            console.log()

            if (args.open || projectDevServerOptions.open) {
              const pageUri =
                projectDevServerOptions.openPage &&
                typeof projectDevServerOptions.openPage === 'string'
                  ? projectDevServerOptions.openPage
                  : ''
              openBrowser(localUrlForBrowser + pageUri)
            }

            // Send final app URL
            if (args.dashboard) {
              const ipc = new IpcMessenger()
              ipc.send({
                vueServe: {
                  url: localUrlForBrowser
                }
              })
            }

            // resolve returned Promise
            // so other commands can do api.service.run('serve').then(...)
            resolve({
              server,
              url: localUrlForBrowser
            })
          } else if (process.env.VUE_CLI_TEST) {
            // signal for test to check HMR
            console.log('App updated')
          }

          server.listen(port, host, err => {
            if (err) {
              reject(err)
            }
          })
        })
      })
    }
  )
}

function addDevClientToEntry(config, devClient) {
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

function checkInContainer() {
  const fs = require('fs')
  if (fs.existsSync(`/proc/1/cgroup`)) {
    const content = fs.readFileSync(`/proc/1/cgroup`, 'utf-8')
    return /:\/(lxc|docker|kubepods)\//.test(content)
  }
}

function genHistoryApiFallbackRewrites(baseUrl, pages = {}) {
  const path = require('path')
  const multiPageRewrites = Object.keys(pages)
    // sort by length in reversed order to avoid overrides
    // eg. 'page11' should appear in front of 'page1'
    .sort((a, b) => b.length - a.length)
    .map(name => ({
      from: new RegExp(`^/${name}`),
      to: path.posix.join(baseUrl, pages[name].filename || `${name}.html`)
    }))
  return [
    ...multiPageRewrites,
    { from: /./, to: path.posix.join(baseUrl, 'index.html') }
  ]
}
