const root = process.cwd()
const path = require('path')
const fs = require('fs')
const isAbsolute = require('is-absolute')

function reader(_path) {
  if (isAbsolute(_path)) {
    return fs.readFileSync(_path, 'utf-8')
  } else {
    let _p = path.resolve(root, _path)
    return fs.readFileSync(_p, 'utf-8')
  }
}

module.exports = reader
