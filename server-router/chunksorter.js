module.exports = {}

module.exports.none = chunks => chunks

module.exports.manual = (
  entryPointNames,
  compilation,
  htmlWebpackPluginOptions
) => {
  const chunks = htmlWebpackPluginOptions.chunks
  if (!Array.isArray(chunks)) {
    return entryPointNames
  }
  // Remove none existing entries from
  // htmlWebpackPluginOptions.chunks
  return chunks.filter(entryPointName => {
    return compilation.entrypoints.has(entryPointName)
  })
}

module.exports.auto = module.exports.none
