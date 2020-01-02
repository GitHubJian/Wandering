const webpack = require('webpack')
const webpackConfig = require('../webpack.config.2')

const compiler = webpack(webpackConfig)

compiler.run((err, stats) => {
  if (err) {
    console.log(err)
  } else {
    console.log('done')
  }
})
