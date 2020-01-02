const uniq = require('lodash.uniq')

const chunkSorter = require('./chunksorter.js')

const isJS = function(file) {
  return /\.js(\?[^.]+)?$/.test(file)
}

const isCSS = function(file) {
  return /\.css(\?[^.]+)?$/.test(file)
}

class ClientPlugin {
  constructor(options) {
    const userOptions = options || {}

    const defaultOptions = {
      filename: 'client-manifest.json',
      chunks: 'all',
      excludeChunks: [],
      chunksSortMode: 'auto'
    }

    this.options = Object.assign(defaultOptions, userOptions)
  }

  apply(compiler) {
    const self = this

    compiler.hooks.emit.tapAsync('client-plugin', (compilation, callback) => {
      const entryNames = Array.from(compilation.entrypoints.keys())
      const filteredEntryNames = self.filterChunks(
        entryNames,
        self.options.chunks,
        self.options.excludeChunks
      )
      const sortedEntryNames = self.sortEntryChunks(
        filteredEntryNames,
        this.options.chunksSortMode,
        compilation
      )

      const manifest = self.clientPluginAssets(compilation, sortedEntryNames)

      const json = JSON.stringify(manifest, null, 2)

      compilation.assets[self.options.filename] = {
        source: function() {
          return json
        },
        size: function() {
          return json.length
        }
      }
      callback()
    })
  }

  clientPluginAssets(compilation, entryNames) {
    const stats = compilation.getStats().toJson()

    const initialFiles = uniq(
      entryNames
        .map(function(name) {
          return stats.entrypoints[name].assets
        })
        .reduce(function(assets, all) {
          return all.concat(assets)
        }, [])
        .filter(function(file) {
          return isJS(file) || isCSS(file)
        })
    )

    const assets = {
      publicPath: stats.publicPath,
      initial: initialFiles,
      async: []
    }

    return assets
  }

  sortEntryChunks(entryNames, sortMode, compilation) {
    if (typeof sortMode === 'function') {
      return entryNames.sort(sortMode)
    }
    if (typeof chunkSorter[sortMode] !== 'undefined') {
      return chunkSorter[sortMode](entryNames, compilation, this.options)
    }
    throw new Error('"' + sortMode + '" is not a valid chunk sort mode')
  }

  filterChunks(chunks, includedChunks, excludedChunks) {
    return chunks.filter(chunkName => {
      if (
        Array.isArray(includedChunks) &&
        includedChunks.indexOf(chunkName) === -1
      ) {
        return false
      }
      if (
        Array.isArray(excludedChunks) &&
        excludedChunks.indexOf(chunkName) !== -1
      ) {
        return false
      }
      return true
    })
  }
}

module.exports = ClientPlugin
