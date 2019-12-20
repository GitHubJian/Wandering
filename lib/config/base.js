module.exports = (api, options) => {
  api.chainWebpack(webpackConfig => {
    const isLegacyBundle =
      process.env.WANDERING_CLI_MODERN_MODE &&
      !process.env.WANDERING_CLI_MODERN_BUILD
    const resolveLocal = require('../util/resolveLocal')
    const getAssetPath = require('../util/getAssetPath')
    const inlineLimit = 4096

    const genAssetSubPath = dir => {
      return getAssetPath(
        options,
        `${dir}/[name]${options.filenameHashing ? '.[hash:8]' : ''}.[ext]`
      )
    }

    const genUrlLoaderOptions = dir => {
      return {
        limit: inlineLimit,
        // use explicit fallback to avoid regression in url-loader >= 1.1.0
        fallback: {
          loader: 'file-loader',
          options: {
            name: genAssetSubPath(dir)
          }
        }
      }
    }

    webpackConfig
      .mode('development')
      .context(api.service.context)
      .entry('app')
      .add('./src/main.js')
      .end()
      .output.path(api.resolve(options.outputDir))
      .filename(isLegacyBundle ? '[name]-legacy.js' : '[name].js')
      .publicPath(options.publicPath)

    webpackConfig.resolve.extensions
      .merge(['.mjs', '.js', '.jsx', '.vue', '.json'])
      .end()
      .modules.add('node_modules')
      .add(api.resolve('node_modules'))
      .add(resolveLocal('node_modules'))
      .end()
      .alias.set('@', api.resolve('src'))
      .set(
        'vue$',
        options.runtimeCompiler
          ? 'vue/dist/vue.esm.js'
          : 'vue/dist/vue.runtime.esm.js'
      )

    webpackConfig.resolveLoader.modules
      .add('node_modules')
      .add(api.resolve('node_modules'))
      .add(resolveLocal('node_modules'))

    webpackConfig.module.noParse(/^(vue|vue-router|vuex|vuex-router-sync)$/)

    webpackConfig.module
      .rule('vue')
      .test(/\.vue$/)
      .use('vue-loader')
      .loader('vue-loader')
      .options({
        compilerOptions: {
          preserveWhitespace: false
        }
      })

    webpackConfig.plugin('vue-loader').use(require('vue-loader/lib/plugin'))

    // static assets
    webpackConfig.module
      .rule('images')
      .test(/\.(png|jpe?g|gif|webp)(\?.*)?$/)
      .use('url-loader')
      .loader(require.resolve('url-loader'))
      .options(genUrlLoaderOptions('img'))

    webpackConfig.module
      .rule('svg')
      .test(/\.(svg)(\?.*)?$/)
      .use('file-loader')
      .loader(require.resolve('file-loader'))
      .options({
        name: genAssetSubPath('img')
      })

    webpackConfig.module
      .rule('media')
      .test(/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/)
      .use('url-loader')
      .loader(require.resolve('url-loader'))
      .options(genUrlLoaderOptions('media'))

    webpackConfig.module
      .rule('fonts')
      .test(/\.(woff2?|eot|ttf|otf)(\?.*)?$/i)
      .use('url-loader')
      .loader(require.resolve('url-loader'))
      .options(genUrlLoaderOptions('fonts'))

    // shims
    webpackConfig.node.merge({
      setImmediate: false,
      process: 'mock',
      dgram: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty'
    })

    const resolveClientEnv = require('../util/resolveClientEnv')
    webpackConfig
      .plugin('define')
      .use(require('webpack/lib/DefinePlugin'), [resolveClientEnv(options)])

    webpackConfig
      .plugin('case-sensitive-paths')
      .use(require('case-sensitive-paths-webpack-plugin'))

    // friendly error plugin displays very confusing errors when webpack
    // fails to resolve a loader, so we provide custom handlers to improve it
    const { transformer, formatter } = require('../util/resolveLoaderError')
    webpackConfig
      .plugin('friendly-errors')
      .use(require('@soda/friendly-errors-webpack-plugin'), [
        {
          additionalTransformers: [transformer],
          additionalFormatters: [formatter]
        }
      ])

    const TerserPlugin = require('terser-webpack-plugin')
    const terserOptions = require('./terserOptions')

    webpackConfig.optimization.minimizer([
      new TerserPlugin(terserOptions(options))
    ])
  })
}
