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
  // const cliServicePath = path.dirname(require.resolve('Wandering'))
  const cliServicePath = `/Users/apple/Documents/workspace/vue-cli-test/node_modules/Wandering/lib`
  const transpileDepRegex = genTranspileDepRegex(options.transpileDependencies)

  babel.loadPartialConfig({ filename: api.resolve('src/main.js') })

  api.chainWebpack(webpackConfig => {
    webpackConfig.resolveLoader.modules.prepend(
      path.join(__dirname, 'node_modules')
    )

    const jsRule = webpackConfig.module
      .rule('js')
      .test(/\.m?jsx?$/)
      .exclude.add(filepath => {
        // exclude dynamic entries
        if (filepath.startsWith(cliServicePath)) {
          return true
        }
        // check if this is something the user explicitly wants to transpile
        if (transpileDepRegex && transpileDepRegex.test(filepath)) {
          return false
        }

        // Don't transpile node_modules
        return /node_modules/.test(filepath)
      })
      .end()
      .use('babel-loader')
      .loader(require.resolve('babel-loader'))
      .options(api.readConfig('babel.config.js'))
      .end()
    // .use('cache-loader')
    // .loader(require.resolve('cache-loader'))
    // .options(
    //   api.genCacheConfig(
    //     'babel-loader',
    //     {
    //       '@babel/core': require('@babel/core/package.json').version,
    //       'babel-loader': require('babel-loader/package.json').version,
    //       modern: !!process.env.VUE_CLI_MODERN_BUILD,
    //       browserslist: api.service.pkg.browserslist
    //     },
    //     ['babel.config.js', '.browserslistrc']
    //   )
    // )
    // .end()

    if (useThreads) {
      const threadLoaderConfig = jsRule
        .use('thread-loader')
        .loader(require.resolve('thread-loader'))

      if (typeof options.parallel === 'number') {
        threadLoaderConfig.options({ workers: options.parallel })
      }
    }

    jsRule.use('babel-loader').loader(require.resolve('babel-loader'))
  })
}
