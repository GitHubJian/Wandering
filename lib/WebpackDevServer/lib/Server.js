const koa = require('koa')
const http = require('http')
const webpackDevMiddleware = require('webpack-dev-middleware')
const webpackHotMiddleware = require('webpack-hot-middleware')

class Server {
  constructor (compiler, options) {
    this.compiler = compiler
    this.options = options

    this.setupApp()
    this.setupDevMiddleware()

    this.setupMiddleware()
    this.createServer()
  }

  setupApp () {
    this.app = new koa()
  }

  setupDevMiddleware () {
    this.middleware = webpackDevMiddleware(
      this.compiler,
      Object.assign({}, this.options, { logLevel: 'info' })
    )

    this.hmr = webpackHotMiddleware(this.compiler, {
      log: console.log,
      path: '/__webpack_hmr',
      heartbeat: 10
    })
  }

  createServer () {
    this.listeningApp = http.createServer(this.app.callback())
  }

  setupMiddleware () {
    this.app.use(async (ctx, next) => {
      ctx.status = 200
      await this.middleware(ctx.req, ctx.res, next)
    })

    this.app.use(async (ctx, next) => {
      await this.hmr(ctx.req, ctx.res, next)
    })
  }

  listen (port, hostname, fn) {
    return this.listeningApp.listen(port, hostname, err => {
      if (err) {
        console.error(err)
      } else {
        console.log(`✨ Server on http://${hostname}:${port}`)
      }
    })
  }
}

module.exports = Server
