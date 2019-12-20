const path = require('path')
const hash = require('hash-sum')
const semver = require('semver')

class PluginAPI {
  constructor(id, service) {
    this.id = id
    this.service = service
  }

  get version() {
    return '1.0.0'
  }

  getCwd() {
    return this.service.context
  }

  resolve(_path) {
    return path.resolve(this.service.context, _path)
  }

  hasPlugin(id) {
    return this.service.plugins.some(p => matchesPluginId(id, p.id))
  }

  registerCommand(name, opts, fn) {
    if (typeof opts === 'function') {
      fn = opts
      opts = null
    }
    this.service.commands[name] = { fn, opts: opts || {} }
  }

  chainWebpack(fn) {
    this.service.webpackChainFns.push(fn)
  }

  configureWebpack(fn) {
    this.service.webpackRawConfigFns.push(fn)
  }

  configureDevServer(fn) {
    this.service.devServerConfigFns.push(fn)
  }

  resolveWebpackConfig(chainableConfig) {
    return this.service.resolveWebpackConfig(chainableConfig)
  }

  resolveChainableWebpackConfig() {
    return this.service.resolveChainableWebpackConfig()
  }
}

module.exports = PluginAPI
