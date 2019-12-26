const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const clientManifest = require('./client-manifest.json')
const view = fs.readFileSync(path.resolve(__dirname, 'tail.njk'), 'utf-8')

const template = fs.readFileSync(
  path.resolve(__dirname, 'template.html'),
  'utf-8'
)

const { createRenderer } = require('../server-renderer')

const renderer = createRenderer({
  template: template,
  clientManifest: clientManifest
})

renderer.renderToString(
  view,
  {
    reportConf: {
      cid: 'abc'
    },
    state: {
      name: 'xiaows'
    }
  },
  function(err, html) {
    debugger
    if (err) {
      console.error(err)
    } else {
      fse.outputFileSync(path.resolve(__dirname, 'output.html'), html, 'utf-8')
    }
  }
)
