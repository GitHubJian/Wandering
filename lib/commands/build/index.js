const defaults = {
  clean: true,
  target: 'app',
  formats: 'commonjs,umd,umd-min'
}

module.exports = (api, options) => {
  api.registerCommand(
    'build',
    {
      description: 'build for production',
      usage: 'wandering-cli-service build [options] [entry|pattern]',
      options: {
        '--mode': 'specify env mode (default: production)',
        '--dest': `specify output directory (default: ${options.outputDir})`,
        '--modern': 'build app targeting modern browsers with auto fallback',
        '--no-unsafe-inline': 'build app without introducing inline scripts',
        '--formats': `list of output formats for library builds (default: ${defaults.formats})`,
        '--no-clean': 'do not remove the dist directory before building the project',
        '--report': 'generate report.html to help analyze bundle content',
        '--report-json': 'generate report.json to help analyze bundle content',
        '--skip-plugins': 'comma-separated list of plugin names to skip for this run',
        '--watch': 'watch for changes'
      }
    },
    async (args, rawArgs) => {
      for (const key in defaults) {
        if (args[key] == null) {
          args[key] = defaults[key]
        }
      }
      args.entry = args.entry || args._[0]

      process.env.WANDERING_CLI_BUILD_TARGET = args.target
      if (args.modern && args.target === 'app') {
        process.env.WANDERING_CLI_MODERN_MODE = true
        if (!process.env.WANDERING_CLI_MODERN_BUILD) {
          // main-process for legacy build
          await build(
            Object.assign({}, args, {
              modernBuild: false,
              keepAlive: true
            }),
            api,
            options
          )
          // spawn sub-process of self for modern build
          const { execa } = require('../../../utils')
          const cliBin = require('path').resolve(
            __dirname,
            '../../../bin/cli-service'
          )
          await execa(cliBin, ['build', ...rawArgs], {
            stdio: 'inherit',
            env: {
              WANDERING_CLI_BUILD_TARGET: true
            }
          })
        } else {
          // sub-process for modern build
          await build(
            Object.assign({}, args, {
              modernBuild: true,
              clean: false
            }),
            api,
            options
          )
        }
        delete process.env.WANDERING_CLI_MODERN_MODE
      } else {
        await build(args, api, options)
      }
      delete process.env.WANDERING_CLI_BUILD_TARGET
    }
  )
}

async function build (args, api, options) {
  const fs = require('fs-extra')
  const path = require('path')
  const chalk = require('chalk')
  const webpack = require('webpack')
  const formatStats = require('./formatStats')
  const {
    log,
    done,
    info,
    logWithSpinner,
    stopSpinner
  } = require('../../../utils')

  log()
  const mode = api.service.mode

  if (args.dest) {
    options.outputDir = args.dest
  }

  const targetDir = api.resolve(args.dest || options.outputDir)
  const isLegacyBuild =
    args.target === 'app' && args.modern && !args.modernBuild

  // resolve raw webpack config
  let webpackConfig
  webpackConfig = require('./resolveAppConfig')(api, args, options)

  if (args.watch) {
    modifyConfig(webpackConfig, config => {
      config.watch = true
    })
  }

  if (args.dashboard) {
    // const DashboardPlugin = require('../../webpack/DashboardPlugin')
    // modifyConfig(webpackConfig, config => {
    //   config.plugins.push(
    //     new DashboardPlugin({
    //       type: 'build',
    //       modernBuild: args.modernBuild,
    //       keepAlive: args.keepAlive
    //     })
    //   )
    // })
  }

  if (args.report || args['report-json']) {
    const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
    modifyConfig(webpackConfig, config => {
      const bundleName =
        args.target !== 'app'
          ? config.output.filename.replace(/\.js$/, '-')
          : isLegacyBuild
            ? 'legacy-'
            : ''
      config.plugins.push(
        new BundleAnalyzerPlugin({
          logLevel: 'warn',
          openAnalyzer: false,
          analyzerMode: args.report ? 'static' : 'disabled',
          reportFilename: `${bundleName}report.html`,
          statsFilename: `${bundleName}report.json`,
          generateStatsFile: !!args['report-json']
        })
      )
    })
  }

  if (args.clean) {
    await fs.remove(targetDir)
  }

  return new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      if (err) {
        return reject(err)
      }

      if (stats.hasErrors()) {
        return reject('Build failed with errors.')
      }

      if (!args.silent) {
        const targetDirShort = path.resolve(api.service.context, targetDir)
        log(formatStats(stats, targetDirShort, api))
        if (args.target === 'app') {
          if (!args.watch) {
            done(
              `Build complete. The ${chalk.cyan(
                targetDirShort
              )} directory is ready to be deployed.`
            )
          } else {
            done('Build complete. Watching for changes...')
          }
        }
      }

      if (process.env.VUE_CLI_TEST) {
        console.log('Build complete.')
      }

      resolve()
    })
  })
}

module.exports.defaultModes = {
  build: 'production'
}

function modifyConfig (config, fn) {
  if (Array.isArray(config)) {
    config.forEach(c => fn(c))
  } else {
    fn(config)
  }
}
