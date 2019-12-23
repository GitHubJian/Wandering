const path = require('path')
const hash = require('hash-sum')
const semver = require('semver')
const fs = require('fs')

class PluginAPI {
  /**
   * @param {string} id - Id of the plugin.
   * @param {Service} service - A cli-service instance.
   */
  constructor(id, service) {
    this.id = id
    this.service = service
  }

  get version() {
    return require('../package.json').version
  }

  /**
   * Current working directory.
   */
  getCwd() {
    return this.service.context
  }

  /**
   * Resolve path for a project.
   *
   * @param {string} _path - Relative path from project root
   * @return {string} The resolved absolute path.
   */
  resolve(_path) {
    return path.resolve(this.service.context, _path)
  }

  /**
   * Register a command that will become available as `cli-service [name]`.
   *
   * @param {string} name
   * @param {object} [opts]
   *   {
   *     description: string,
   *     usage: string,
   *     options: { [string]: string }
   *   }
   * @param {function} fn
   *   (args: { [string]: string }, rawArgs: string[]) => ?Promise
   */
  registerCommand(name, opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = null
    }
    this.service.commands[name] = { fn, opts: opts || {} }
  }

  /**
   * Register a function that will receive a chainable webpack config
   * the function is lazy and won't be called until `resolveWebpackConfig` is
   * called
   *
   * @param {function} fn
   */
  chainWebpack(fn) {
    this.service.webpackChainFns.push(fn)
  }

  /**
   * Register
   * - a webpack configuration object that will be merged into the config
   * OR
   * - a function that will receive the raw webpack config.
   *   the function can either mutate the config directly or return an object
   *   that will be merged into the config.
   *
   * @param {object | function} fn
   */
  configureWebpack(fn) {
    this.service.webpackRawConfigFns.push(fn)
  }

  /**
   * Register a dev serve config function. It will receive the express `app`
   * instance of the dev server.
   *
   * @param {function} fn
   */
  configureDevServer(fn) {
    this.service.devServerConfigFns.push(fn)
  }

  /**
   * Resolve the final raw webpack config, that will be passed to webpack.
   *
   * @param {ChainableWebpackConfig} [chainableConfig]
   * @return {object} Raw webpack config.
   */
  resolveWebpackConfig(chainableConfig) {
    return this.service.resolveWebpackConfig(chainableConfig)
  }

  /**
   * Resolve an intermediate chainable webpack config instance, which can be
   * further tweaked before generating the final raw webpack config.
   * You can call this multiple times to generate different branches of the
   * base webpack config.
   * See https://github.com/mozilla-neutrino/webpack-chain
   *
   * @return {ChainableWebpackConfig}
   */
  resolveChainableWebpackConfig() {
    return this.service.resolveChainableWebpackConfig()
  }

  /**
   * Generate a cache identifier from a number of variables
   */
  genCacheConfig(id, partialIdentifier, configFiles = []) {
    const cacheDirectory = this.resolve(`node_modules/.cache/${id}`)

    const fmtFunc = conf => {
      if (typeof conf === 'function') {
        return conf.toString().replace(/\r\n?/g, '\n')
      }
      return conf
    }

    const variables = {
      partialIdentifier,
      'cli-service': require('../package.json').version,
      'cache-loader': require('cache-loader/package.json').version,
      env: process.env.NODE_ENV,
      test: !!process.env.WANDERING_CLI_TEST,
      config: [
        fmtFunc(this.service.projectOptions.chainWebpack),
        fmtFunc(this.service.projectOptions.configureWebpack)
      ]
    }

    if (!Array.isArray(configFiles)) {
      configFiles = [configFiles]
    }
    configFiles = configFiles.concat(['package-lock.json', 'yarn.lock'])

    const readConfig = file => {
      const absolutePath = this.resolve(file)
      if (!fs.existsSync(absolutePath)) {
        return
      }

      if (absolutePath.endsWith('.js')) {
        try {
          return JSON.stringify(require(absolutePath))
        } catch (e) {
          return fs.readFileSync(absolutePath, 'utf-8')
        }
      } else {
        return fs.readFileSync(absolutePath, 'utf-8')
      }
    }

    for (const file of configFiles) {
      const content = readConfig(file)
      if (content) {
        variables.configFiles = content.replace(/\r\n?/g, '\n')
        break
      }
    }

    const cacheIdentifier = hash(variables)
    return { cacheDirectory, cacheIdentifier }
  }

  readConfig(file) {
    const absolutePath = this.resolve(file)
    if (!fs.existsSync(absolutePath)) {
      return
    }

    if (absolutePath.endsWith('.js')) {
      try {
        return JSON.stringify(require(absolutePath))
      } catch (e) {
        return fs.readFileSync(absolutePath, 'utf-8')
      }
    } else {
      return fs.readFileSync(absolutePath, 'utf-8')
    }
  }
}

module.exports = PluginAPI
