module.exports = {
  publicPath: '/',
  outputDir: 'static',
  assetsDir: '',
  indexPath: 'index.html',
  filenameHashing: true,
  pages: {
    preact: {
      entry: 'src/preact-app.js',
      filename: 'preact.html'
    },
    vue: {
      entry: 'src/vue-app.js',
      filename: 'vue.html'
    },
    react: {
      entry: 'src/react-app.js',
      filename: 'react.html'
    }
  }
}
