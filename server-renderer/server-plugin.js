var fs = require('fs')
var path = require('path')
var root = process.cwd()

var isJS = function(file) {
  return /\.js(\?[^.]+)?$/.test(file)
}

function onEmit(compiler, name, hook) {
  if (compiler.hooks) {
    compiler.hooks.emit.tapAsync(name, hook)
  } else {
    compiler.plugin('emit', hook)
  }
}

function NjkSSRServerPlugin(options) {
  if (options === void 0) options = {}

  this.options = Object.assign(
    {
      filename: 'njk-ssr-server-bundle.json',
      basedir: path.resolve(root, 'src')
    },
    options
  )
}

NjkSSRServerPlugin.prototype.apply = function apply(compiler) {
  var this$1 = this

  onEmit(compiler, 'njk-server-plugin', function(compilation, cb) {
    var stats = compilation.getStats().toJson()
    var entryName = Object.keys(stats.entrypoints)[0]
    var entryInfo = stats.entrypoints[entryName]

    if (!entryInfo) {
      return cb()
    }

    var entryAssets = entryInfo.assets.filter(isJS)

    if (entryAssets.length > 1) {
      throw new Error(
        'Server-side bundle should have one single entry file. ' +
          'Avoid using CommonsChunkPlugin in the server config.'
      )
    }

    var entry = entryAssets[0]
    if (!entry || typeof entry !== 'string') {
      throw new Error(
        'Entry "' +
          entryName +
          '" not found. Did you specify the correct entry option?'
      )
    }

    var bundle = {
      entry: entry,
      files: {},
      maps: {}
    }

    Object.keys(stats.entrypoints).forEach(function(name) {
      var filepath = path.resolve(this$1.options.basedir, name, 'app.njk')
      if (fs.existsSync(filepath)) {
        bundle.files[name] = fs.readFileSync(filepath, 'utf-8')
      }
    })

    var json = JSON.stringify(bundle, null, 2)
    var filename = this$1.options.filename

    compilation.assets[filename] = {
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

module.exports = NjkSSRServerPlugin
