const _ = require('lodash')
const path = require('path')
const chunkSorter = require('./chunksorter.js')

class HtmlWebpackPlugin {
  constructor(options) {
    const userOptions = options || {}

    const defaultOptions = {
      chunks: 'all',
      excludeChunks: [],
      chunksSortMode: 'auto'
    }

    this.options = Object.assign(defaultOptions, userOptions)
  }

  apply(compiler) {
    debugger
    const self = this

    compiler.hooks.emit.tapAsync(
      'HtmlWebpackPlugin',
      (compilation, callback) => {
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

        const assets = self.htmlWebpackPluginAssets(
          compilation,
          sortedEntryNames
        )
        debugger
        const assetJson = JSON.stringify(self.getAssetFiles(assets))

        callback()
      }
    )
  }

  generatedScriptTags(jsAssets) {
    return jsAssets.map(scriptAsset => {
      return {
        tagName: 'script',
        voidTag: false,
        attributes: {
          src: scriptAsset
        }
      }
    })
  }

  getAssetFiles(assets) {
    const files = _.uniq(
      Object.keys(assets)
        .filter(assetType => assetType !== 'chunks' && assets[assetType])
        .reduce((files, assetType) => files.concat(assets[assetType]), [])
    )
    files.sort()
    return files
  }

  htmlWebpackPluginAssets(compilation, entryNames) {
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

module.exports = HtmlWebpackPlugin
