const path = require('path')

const defaultPolyfills = [
  'es.array.iterator',
  'es.promise',
  'es.object.assign',
  'es.promise.finally'
]

function getPolyfills(
  targets,
  includes,
  { ignoreBrowserslistConfig, configPath }
) {
  const { isPluginRequired } = require('@babel/preset-env')
  const builtInsList = require('core-js-compat/data')
  const getTargets = require('@babel/preset-env/lib/targets-parser').default
  const builtInTargets = getTargets(targets, {
    ignoreBrowserslistConfig,
    configPath
  })

  return includes.filter(item => {
    return isPluginRequired(builtInTargets, builtInsList[item])
  })
}

module.exports = (context, options = {}) => {
  const presets = []
  const plugins = []
  const defaultEntryFiles = JSON.parse(
    process.env.WANDERING_CLI_ENTRY_FILES || '[]'
  )

  const runtimePath = path.dirname(
    require.resolve('@babel/runtime/package.json')
  )
  const {
    polyfills: userPolyfills,
    loose = false,
    debug = false,
    useBuiltIns = 'usage',
    modules = false,
    targets: rawTargets,
    spec,
    configPath,
    include,
    exclude,
    shippedProposals,
    forceAllTransforms,
    decoratorsBeforeExport,
    decoratorsLegacy,
    entryFiles = defaultEntryFiles,
    absoluteRuntime = runtimePath
  } = options

  // resolve targets
  let targets
  if (process.env.WANDERING_CLI_BABEL_TARGET_NODE) {
    // running tests in Node.js
    targets = { node: 'current' }
  } else if (process.env.WANDERING_CLI_MODERN_BUILD) {
    // targeting browsers that support <script type="module">
    targets = { esmodules: true }
  } else {
    targets = rawTargets
  }

  let polyfills
  const buildTarget = process.env.VUE_CLI_BUILD_TARGET || 'app'
  if (
    buildTarget === 'app' &&
    useBuiltIns === 'usage' &&
    !process.env.WANDERING_CLI_BABEL_TARGET_NODE &&
    !process.env.WANDERING_CLI_MODERN_BUILD
  ) {
    polyfills = getPolyfills(targets, userPolyfills || defaultPolyfills, {
      ignoreBrowserslistConfig,
      configPath
    })
    plugins.push([
      require('./polyfillsPlugin'),
      { polyfills, entryFiles, useAbsolutePath: !!absoluteRuntime }
    ])
  } else {
    polyfills = []
  }

  const envOptions = {
    corejs: 3,
    spec,
    loose,
    debug,
    modules,
    targets,
    useBuiltIns,
    ignoreBrowserslistConfig,
    configPath,
    include,
    exclude: polyfills.concat(exclude || []),
    shippedProposals,
    forceAllTransforms
  }

  presets.unshift([require('@babel/preset-env'), envOptions])

  plugins.push(
    require('@babel/plugin-syntax-dynamic-import'),
    [
      require('@babel/plugin-proposal-decorators'),
      {
        decoratorsBeforeExport,
        legacy: decoratorsLegacy !== false
      }
    ],
    [require('@babel/plugin-proposal-class-properties'), { loose }]
  )

  // transform runtime, but only for helpers
  plugins.push([
    require('@babel/plugin-transform-runtime'),
    {
      regenerator: useBuiltIns !== 'usage',

      // polyfills are injected by preset-env & polyfillsPlugin, so no need to add them again
      corejs: false,

      helpers: useBuiltIns === 'usage',
      useESModules: !process.env.WANDERING_CLI_BABEL_TRANSPILE_MODULES,

      absoluteRuntime
    }
  ])

  return {
    sourceType: 'unambiguous',
    overrides: [
      {
        exclude: [/@babel[\/|\\\\]runtime/, /core-js/],
        presets,
        plugins
      },
      {
        // there are some untranspiled code in @babel/runtime
        // https://github.com/babel/babel/issues/9903
        include: [/@babel[\/|\\\\]runtime/],
        presets: [
          [
            require('@babel/preset-env'),
            {
              useBuiltIns,
              corejs: 3
            }
          ]
        ]
      }
    ]
  }
}
