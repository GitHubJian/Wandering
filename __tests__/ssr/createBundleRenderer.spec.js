const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const clientManifest = require('./client-manifest.json')
const serverBundle = require('./server-bundle.json')

const template = fs.readFileSync(
  path.resolve(__dirname, 'template.html'),
  'utf-8'
)

const { createBundleRenderer } = require('../../server-renderer')

const renderer = createBundleRenderer(serverBundle, {
  template: template,
  clientManifest
})

renderer.renderToString(
  {
    reportConf: {
      cid: 'abc'
    },
    state: {
      name: 'xiaows'
    }
  },
  function (err, html) {
    if (err) {
      console.error(err)
    } else {
      fse.outputFileSync(path.resolve(__dirname, 'output.html'), html, 'utf-8')
    }
  }
)
