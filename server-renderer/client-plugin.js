var isJS = function(file) {
  return /\.js(\?[^.]+)?$/.test(file)
}

var isCSS = function(file) {
  return /\.css(\?[^.]+)?$/.test(file)
}

var hash = require('hash-sum')
var uniq = require('lodash.uniq')

var onEmit = function(compiler, name, hook) {
  if (compiler.hooks) {
    compiler.hooks.emit.tapAsync(name, hook)
  } else {
    compiler.plugin('emit', hook)
  }
}

function NjkSSRClientPlugin(options) {
  if (options === void 0) options = {}

  this.options = Object.assign(
    {
      filename: 'njk-ssr-client-manifest.json',
      chunks: []
    },
    options
  )
}

NjkSSRClientPlugin.prototype.apply = function apply(compiler) {
  var this$1 = this

  onEmit(compiler, 'njk-client-plugin', function(compilation, cb) {
    var stats = compilation.getStats().toJson()

    var assetsByChunkName = Object.keys(stats.entrypoints).reduce(function(
      prev,
      name
    ) {
      prev[name] = stats.entrypoints[name].assets.filter(function(file) {
        return isJS(file) || isCSS(file)
      })

      return prev
    },
    {})

    var manifest = {
      publicPath: stats.publicPath,
      assetsByChunkName: assetsByChunkName
    }

    var json = JSON.stringify(manifest, null, 2)
    compilation.assets[this$1.options.filename] = {
      source: function() {
        return json
      },
      size: function() {
        return json.length
      }
    }
    cb()
  })
}

module.exports = NjkSSRClientPlugin
