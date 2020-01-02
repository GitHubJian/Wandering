const webpack = require('webpack')
const addEntries = require('./addEntries')

function updateCompiler (compiler, options) {
  const findHMRPlugin = config => {
    if (!config.plugins) {
      return undefined
    }

    return config.plugins.find(
      plugin => plugin.constructor === webpack.HotModuleReplacementPlugin
    )
  }

  const compilers = []
  const compilersWithoutHMR = []
  let webpackConfig

  webpackConfig = compiler.options
  compilers.push(compiler)

  if (!findHMRPlugin(compiler.options)) {
    compilersWithoutHMR.push(compiler)
  }

  addEntries(webpackConfig, options)
  compiler.forEach(compiler => {
    const config = compiler.options
    compiler.hooks.entryOption.call(config.context, config.entry)
  })
}

module.exports = updateCompiler
