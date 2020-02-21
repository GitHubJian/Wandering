const path = require('path')
const fs = require('fs')
const pathToRegexp = require('path-to-regexp')
const { createRenderer } = require('../server-renderer')
const url = require('url')

class Router {
  constructor(routes, context = process.cwd(), baseUrls = {}) {
    this.context = context
    this.baseUrls = baseUrls

    this.app = this.baseUrls.app || '/'
    this.baseView = this.baseUrls.view || this.resolve('src')
    this.baseTemplate = this.baseUrls.template || 'public'
    this.baseManifest = this.baseUrls.manifest || 'static'

    this.routes = routes

    this.map = Object.create(null)

    this.init()
  }

  init() {
    this.normalizeRoutes()

    const basedir = this.baseView

    this.routes.forEach(({ path, view, template, manifest }) => {
      this.map[path] = this._createRenderer(basedir, view, template, manifest)
    })
  }

  _createRenderer(basedir, view, template, manifest) {
    const clientManifest = this.readManifestFile(manifest)
    const tmpl = this.readTemplateFile(template)

    const renderer = createRenderer({
      basedir,
      template: tmpl,
      clientManifest: clientManifest
    })

    return async function(state) {
      const raw = await renderer.renderToString(view, state)

      return raw
    }
  }

  normalizeRoutes() {
    this.routes.forEach(route => {
      route.path = url.resolve(this.app, route.path)
      route.view = this.resolve(route.view, this.baseView)
      route.template = this.resolve(route.template, this.baseTemplate)
      route.manifest = this.resolve(route.manifest, this.baseManifest)
    })
  }

  readManifestFile(path) {
    try {
      const file = fs.readFileSync(path, 'utf-8')

      return JSON.parse(file)
    } catch (error) {
      console.error('read manifest is error, path is ' + path)

      return {
        publicPath: '/',
        initial: [],
        async: []
      }
    }
  }

  readTemplateFile(path) {
    try {
      return fs.readFileSync(path, 'utf-8')
    } catch (error) {
      console.error('read template is error, path is ' + path)

      return ''
    }
  }

  resolve(_path, context = this.context) {
    return path.resolve(context, _path)
  }

  match(path) {
    let re = Object.keys(this.map).find(function(p) {
      const regexp = pathToRegexp(p)

      return regexp.exec(path)
    })

    if (!re) {
      throw new Error(`path renderer not found, ${path}`)
    }

    return this.map[re]
  }
}

module.exports = Router
