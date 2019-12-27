const webpack = require('webpack')
const webpackConfig = require('../webpack.config')

const compiler = webpack(webpackConfig)

compiler.run((err, stats) => {
  if (err) {
    console.log(e)
  } else {
    console.log('done')
  }
})
