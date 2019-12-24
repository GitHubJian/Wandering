module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        modules: 'auto',
        targets: {
          browsers: ['Android >= 4.0', 'ios >= 6'],
          esmodules: true
        },
        loose: false,
        debug: false,
        include: [],
        corejs: 2,
        useBuiltIns: 'usage'
      }
    ]
  ],
  plugins: [
    [
      '@babel/plugin-transform-runtime',
      {
        corejs: false,
        helpers: true,
        regenerator: true,
        useESModules: false
      }
    ],
    ['@babel/plugin-syntax-dynamic-import', {}],
    ['@babel/plugin-proposal-optional-chaining', {}],
    ['@babel/plugin-transform-modules-commonjs', {}],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-transform-react-jsx', { pragma: 'h' }],
    ['@babel/plugin-proposal-export-namespace-from'],
    ['@babel/plugin-proposal-export-default-from'],
    ['@babel/plugin-transform-classes', { loose: true }]
  ],
  comments: false
}
