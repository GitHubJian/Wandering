const { addSideEffect } = require('@babel/helper-module-imports')

function getModulePath(mod, useAbsolutePath) {
  const modPath =
    mod === 'regenerator-runtime'
      ? 'regenerator-runtime/runtime'
      : `core-js/modules/${mod}`
  return useAbsolutePath ? require.resolve(modPath) : modPath
}

function createImport(path, mod, useAbsolutePath) {
  return addSideEffect(path, getModulePath(mod, useAbsolutePath))
}

// add polyfill imports to the first file encountered.
module.exports = (
  { types },
  { polyfills, entryFiles = [], useAbsolutePath }
) => {
  return {
    name: 'cli-inject-polyfills',
    visitor: {
      Program(path, state) {
        if (!entryFiles.includes(state.filename)) {
          return
        }

        polyfills
          .slice()
          .reverse()
          .forEach(p => {
            createImport(path, p, useAbsolutePath)
          })
      }
    }
  }
}
