const path = require('path')
const babel = require('@babel/core')

module.exports = (api, options) => {
  const useThreads = process.env.NODE_ENV === 'production' && !!options.parallel

  api.chainWebpack(webpackConfig => {
    webpackConfig.resolveLoader.modules.prepend(
      path.join(__dirname, 'node_modules')
    )

    const jsRule = webpackConfig.module
      .rule('jsx')
      .test(/\.jsx?$/)
      .use('babel-loader')
      .loader(require.resolve('babel-loader'))
      .options({
        presets: [
          [
            '@babel/preset-env',
            {
              modules: 'auto',
              targets: {
                browsers: ['Android >= 4.0', 'ios >= 6'],
                "esmodules": true,
              },
              loose:false,
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
      })
      .end()

    if (useThreads) {
      const threadLoaderConfig = jsRule
        .use('thread-loader')
        .loader(require.resolve('thread-loader'))

      if (typeof options.parallel === 'number') {
        threadLoaderConfig.options({ workers: options.parallel })
      }
    }
  })
}
