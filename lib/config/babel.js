const path = require('path')
const babel = require('@babel/core')

module.exports = (api, options) => {
  const useThreads = process.env.NODE_ENV === 'production' && !!options.parallel

  api.chainWebpack(webpackConfig => {
    webpackConfig.resolveLoader.modules.prepend(
      path.join(__dirname, 'node_modules')
    )

    const jsRule = webpackConfig.module
      .rule('js')
      .test(/\.m?jsx?$/)
      .exclude.add(filepath => {
        if (filepath.includes(path.join('@babel', 'runtime'))) {
          return false
        }

        // Don't transpile node_modules
        return /node_modules/.test(filepath)
      })
      .end()
      .use('babel-loader')
      .loader(require.resolve('babel-loader'))
      .options(
        api.loadBabelConfig(
          'babel.config.js',
          path.resolve(__dirname, 'babel-default.js')
        )
      )
      .end()

    if (useThreads) {
      const threadLoaderConfig = jsRule
        .use('thread-loader')
        .loader(require.resolve('thread-loader'))

      if (typeof options.parallel === 'number') {
        threadLoaderConfig.options({ workers: options.parallel })
      }
    }
  })
}
