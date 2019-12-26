const path = require('path')
const babelmerge = require('babel-merge')
const deepmerge = require('deepmerge')

const combineMerge = (target, source, options) => {
  const destination = target.slice()

  source.forEach((item, index) => {
    if (typeof destination[index] === 'undefined') {
      destination[index] = options.cloneUnlessOtherwiseSpecified(item, options)
    } else if (options.cloneUnlessOtherwiseSpecified(item)) {
      destination[index] = deepmerge(target[index], item, options)
    } else if (target.indexOf(item) === -1) {
      destination.push(item)
    }
  })

  return destination
}

let defaultOptions = require(path.resolve(
  __dirname,
  '../bin/config',
  'babel-default.js'
))
let userOptions = require(path.resolve(__dirname, '..', 'babel.config.js'))
try {
  const together = babelmerge(defaultOptions, userOptions)

  console.log(together)
} catch (error) {
  console.error(error)
}
