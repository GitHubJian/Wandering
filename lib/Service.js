const fs = require('fs')
const path = require('path')
const debug = require('debug')
const chalk = require('chalk')
const readPkg = require('read-pkg')
const merge = require('webpack-merge')
const Config = require('webpack-chain')
const PluginAPI = require('./PluginAPI')
const defaultsDeep = require('lodash.defaultsdeep')

const { error, warn } = require('../utils')

const { defaults } = require('./options')

class Service {
  constructor(context, { plugins, pkg, inlineOptions, useBuiltIn } = {}) {
    this.initialized = false
    this.context = context
    this.inlineOptions = inlineOptions
    this.webpackChainFns = []
    this.webpackRawConfigFns = []
    this.devServerConfigFns = []
    this.commands = {}
    this.pkgContext = context

    this.pkg = this.resolvePkg(pkg)

    this.plugins = this.resolvePlugins(plugins, useBuiltIn)

    this.modes = this.plugins.reduce((modes, { apply: { defaultModes } }) => {
      return Object.assign(modes, defaultModes)
    })
  }

  resolvePkg(inlinePkg, context = this.context) {
    if (inlinePkg) {
      return inlinePkg
    } else if (fs.existsSync(path.join(context, 'package.json'))) {
      const pkg = readPkg.sync({ cwd: context })
      if (pkg.vuePlugins && pkg.vuePlugins.resolveFrom) {
        this.pkgContext = path.resolve(context, pkg.vuePlugins.resolveFrom)
        return this.resolvePkg(null, this.pkgContext)
      }
      return pkg
    } else {
      return {}
    }
  }

  init(mode) {
    if (this.initialized) {
      return
    }
    this.initialized = true
    this.mode = mode

    const userOptions = this.loadUserOptions()
    this.projectOptions = defaultsDeep(userOptions, defaults())

    this.plugins.forEach(({ id, apply }) => {
      apply(new PluginAPI(id, this), this.projectOptions)
    })

    if (this.projectOptions.chainWebpack) {
      this.webpackChainFns.push(this.projectOptions.chainWebpack)
    }

    if (this.projectOptions.configureWebpack) {
      this.webpackRawConfigFns.push(this.projectOptions.configureWebpack)
    }
  }

  resolvePlugins() {
    const idToPlugin = id => ({
      id: id.replace(/^.\//, 'built-in:'),
      apply: require(id)
    })

    const buildInPlugins = [
      './commands/serve',
      './commands/build',
      './commands/help',
      './config/base',
      './config/css',
      './config/babel',
      './config/prod',
      './config/app'
    ].map(idToPlugin)

    return buildInPlugins
  }

  async run(name, args = {}, rawArgv = []) {
    const mode = 'production'

    this.init(mode)

    args._ = args._ || []
    let command = this.commands[name]

    if (!command && name) {
      error(`command "${name}" does not exist.`)
      process.exit(1)
    }
    if (!command || args.help || args.h) {
      command = this.commands.help
    } else {
      args._.shift()
      rawArgv.shift()
    }

    const { fn } = command

    return fn(args, rawArgv)
  }

  resolveChainableWebpackConfig() {
    const chainableConfig = new Config()

    this.webpackChainFns.forEach(fn => fn(chainableConfig))

    return chainableConfig
  }

  resolveWebpackConfig(chainableConfig = this.resolveChainableWebpackConfig()) {
    if (!this.initialized) {
      throw new Error(
        'Service must call init() before calling resolveWebpackConfig().'
      )
    }
    let config = chainableConfig.toConfig()
    const original = config
    this.webpackRawConfigFns.forEach(fn => {
      if (typeof fn === 'function') {
        const res = fn(config)
        if (res) config = merge(config, res)
      } else if (fn) {
        config = merge(config, fn)
      }
    })

    if (config !== original) {
      cloneRuleNames(
        config.module && config.module.rules,
        original.module && original.module.rules
      )
    }

    return config
  }

  loadUserOptions() {
    let fileConfig, pkgConfig, resolved, resolvedFrom
    const configPath = path.resolve(this.context, 'wandering.config.js')

    if (fs.existsSync(configPath)) {
      try {
        fileConfig = require(configPath)

        if (typeof fileConfig === 'function') {
          fileConfig = fileConfig()
        }

        if (!fileConfig || typeof fileConfig !== 'object') {
          error(
            `Error loading ${chalk.bold(
              'wandering.config.js'
            )}: should export an object or a function that returns object.`
          )
          fileConfig = null
        }
      } catch (error) {
        error(`Error loading ${chalk.bold('wandering.config.js')}:`)
        throw e
      }
    }

    pkgConfig = this.pkg.wandering
    if (pkgConfig && typeof pkgConfig !== 'object') {
      error(
        `Error loading wandering-cli config in ${chalk.bold(
          `package.json`
        )}: ` + `the "wandering" field should be an object.`
      )
      pkgConfig = null
    }

    if (fileConfig) {
      resolved = fileConfig
      resolvedFrom = 'wandering.config.js'
    } else if (pkgConfig) {
      resolved = pkgConfig
      resolveFrom = '"wandering" field in package.json'
    } else {
      resolved = {}
      resolvedFrom = 'inline options'
    }

    if (resolved.css && typeof resolved.css.modules !== 'undefined') {
      if (typeof resolved.css.requireModuleExtension !== 'undefined') {
        warn(
          `You have set both "css.modules" and "css.requireModuleExtension" in ${chalk.bold(
            'wandering.config.js'
          )}, ` +
            `"css.modules" will be ignored in favor of "css.requireModuleExtension".`
        )
      } else {
        warn(
          `"css.modules" option in ${chalk.bold('wandering.config.js')} ` +
            `is deprecated now, please use "css.requireModuleExtension" instead.`
        )
        resolved.css.requireModuleExtension = !resolved.css.modules
      }
    }

    ensureSlash(resolved, 'publicPath')

    if (typeof resolved.publicPath === 'string') {
      resolved.publicPath = resolved.publicPath.replace(/^\.\//, '')
    }

    removeSlash(resolved, 'outputDir')

    return resolved
  }
}

function ensureSlash(config, key) {
  let val = config[key]
  if (typeof val === 'string') {
    if (!/^https?:/.test(val)) {
      val = val.replace(/^([^/.])/, '/$1')
    }
    config[key] = val.replace(/([^/])$/, '$1/')
  }
}

function removeSlash(config, key) {
  if (typeof config[key] === 'string') {
    config[key] = config[key].replace(/\/$/g, '')
  }
}

function cloneRuleNames(to, from) {
  if (!to || !from) {
    return
  }
  from.forEach((r, i) => {
    if (to[i]) {
      Object.defineProperty(to[i], '__ruleNames', {
        value: r.__ruleNames
      })
      cloneRuleNames(to[i].oneOf, r.oneOf)
    }
  })
}

module.exports = Service
