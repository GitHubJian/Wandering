const _ = require('lodash')
const path = require('path')

const chunkSorter = require('./chunksorter.js')

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
      const stats = compilation.getStats().toJson()

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
    let publicPath = '/'

    const assets = {
      publicPath: publicPath,
      js: [],
      css: [],
      manifest: Object.keys(compilation.assets).find(
        assetFile => path.extname(assetFile) === '.appcache'
      )
    }

    const entryPointPublicPathMap = {}
    const extensionRegexp = /\.(css|js|mjs)(\?|$)/
    for (let i = 0; i < entryNames.length; i++) {
      const entryName = entryNames[i]
      const entryPointFiles = compilation.entrypoints.get(entryName).getFiles()

      const entryPointPublicPaths = entryPointFiles.map(chunkFile => {
        const entryPointPublicPath = publicPath + this.urlencodePath(chunkFile)
        return entryPointPublicPath
      })

      entryPointPublicPaths.forEach(entryPointPublicPath => {
        const extMatch = extensionRegexp.exec(entryPointPublicPath)

        if (!extMatch) {
          return
        }

        if (entryPointPublicPathMap[entryPointPublicPath]) {
          return
        }
        entryPointPublicPathMap[entryPointPublicPath] = true

        const ext = extMatch[1] === 'mjs' ? 'js' : extMatch[1]
        assets[ext].push(entryPointPublicPath)
      })
    }
    return assets
  }

  urlencodePath(filePath) {
    return filePath
      .split('/')
      .map(encodeURIComponent)
      .join('/')
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
