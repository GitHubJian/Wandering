const path = require('path')
const babel = require('@babel/core')

function genTranspileDepRegex(transpileDependencies) {
  const deps = transpileDependencies.map(dep => {
    if (typeof dep === 'string') {
      const depPath = path.join('node_modules', dep, '/')
      return isWindows
        ? depPath.replace(/\\/g, '\\\\') // double escape for windows style path
        : depPath
    } else if (dep instanceof RegExp) {
      return dep.source
    }
  })
  return deps.length ? new RegExp(deps.join('|')) : null
}

module.exports = (api, options) => {
  const useThreads = process.env.NODE_ENV === 'production' && !!options.parallel
  const cliServicePath = path.dirname(require.resolve('@vue/cli-service'))
  const transpileDepRegex = genTranspileDepRegex(options.transpileDependencies)

  babel.loadPartialConfig({ filename: api.resolve('src/main.js') })

  api.chainWebpack(webpackConfig => {
    webpackConfig.resolveLoader.modules.prepend(
      path.join(__dirname, 'node_modules')
    )

    const jsRule = webpackConfig.module
      .rule('js')
      .test(/\.m?jsx?$/)
      .use('babel-loader')
      .loader(require.resolve('babel-loader'))
      .options(require('./preset'))
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
