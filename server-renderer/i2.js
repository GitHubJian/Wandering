var path$2 = require('path')
var fs = require('fs')
var serialize = require('serialize-javascript')
var nunjucks = require('nunjucks')
var environment

var INVALID_MSG =
  'Invalid server-rendering bundle format. Should be a string ' +
  'or a bundle Object of type:\n\n' +
  '{\n  entry: string;\n  files: { [filename: string]: string; };\n  maps: { [filename: string]: string; };\n}\n'

var isJS = function(file) {
  return /\.js(\?[^.]+)?$/.test(file)
}

var isCSS = function(file) {
  return /\.css(\?[^.]+)?$/.test(file)
}

function compile$1(template) {
  var tmpl = new nunjucks.Template(template, environment, true)

  return function(context) {
    return tmpl.render(context)
  }
}

function parseTemplate(template, contentPlaceholder) {
  if (contentPlaceholder === void 0)
    contentPlaceholder = '<!--njk-ssr-outlet-->'

  if (typeof template === 'object') {
    return template
  }

  if (j < 0) {
    throw new Error('Content placeholder not found in template.')
  }

  var i = template.indexOf('</head>')
  var j = template.indexOf(contentPlaceholder)

  if (i < 0) {
    i = template.indexOf('<body>')
    if (i < 0) {
      i = j
    }
  }

  return {
    head: compile$1(template.slice(0, i)),
    neck: compile$1(template.slice(i, j)),
    tail: compile$1(template.slice(j + contentPlaceholder.length))
  }
}

function createPromiseCallback() {
  var resolve, reject
  var promise = new Promise(function(_resolve, _reject) {
    resolve = _resolve
    reject = _reject
  })
  var cb = function(err, res) {
    if (err) {
      return reject(err)
    }
    resolve(res || '')
  }
  return { promise: promise, cb: cb }
}

function createMapper(clientManifest) {
  // map server-side moduleIds to client-side files
  return function mapper(moduleIds) {
    return []
  }
}

function TemplateRenderer(options) {
  this.options = options
  // if no template option is provided, the renderer is created
  // as a utility object for rendering assets like preload links and scripts.

  var template = options.template
  this.parsedTemplate = template
    ? typeof template === 'string'
      ? parseTemplate(template)
      : template
    : null

  // function used to serialize initial state JSON
  this.serialize =
    options.serializer ||
    function(state) {
      return serialize(state, { isJSON: true })
    }

  // extra functionality with client manifest
  if (options.clientManifest) {
    var clientManifest = (this.clientManifest = options.clientManifest)
    // ensure publicPath ends with /
    this.publicPath =
      clientManifest.publicPath === ''
        ? ''
        : clientManifest.publicPath.replace(/([^\/])$/, '$1/')
    // preload/prefetch directives
    this.preloadFiles = (clientManifest.initial || []).map(normalizeFile)
    this.prefetchFiles = (clientManifest.async || []).map(normalizeFile)
    // initial async chunk mapping
    // this.mapFiles = createMapper(clientManifest)
    this.mapFiles = createMapper(clientManifest)
  }
}

TemplateRenderer.prototype.bindRenderFns = function bindRenderFns(context) {
  var renderer = this

  ;['ResourceHints', 'State', 'Scripts', 'Styles'].forEach(function(type) {
    context['render' + type] = renderer['render' + type].bind(renderer, context)
  })

  context.getPreloadFiles = renderer.getPreloadFiles.bind(renderer, context)
}

TemplateRenderer.prototype.render = function render(content, context) {
  var template = this.parsedTemplate
  if (!template) {
    throw new Error('render cannot be called without a template.')
  }
  context = context || {}

  if (typeof template === 'function') {
    return template(content, context)
  }

  return (
    template.head(context) +
    (context.head || '') +
    this.renderResourceHints(context) +
    this.renderStyles(context) +
    template.neck(context) +
    content +
    this.renderState(context) +
    this.renderScripts(context) +
    template.tail(context)
  )
}

TemplateRenderer.prototype.renderStyles = function renderStyles(context) {
  var this$1 = this

  var initial = this.preloadFiles || []

  var async = this.getUsedAsyncFiles(context) || []

  var cssFiles = initial.concat(async).filter(function(ref) {
    var file = ref.file

    return isCSS(file)
  })

  return (
    // render links for css files
    (cssFiles.length
      ? cssFiles.map(function(ref) {
          var file = ref.file

          return (
            '<link rel="stylesheet" href="' + this$1.publicPath + file + '">'
          )
        })
      : '') + (context.styles || '')
  )
}

TemplateRenderer.prototype.renderResourceHints = function renderResourceHints(
  context
) {
  return this.renderPreloadLinks(context) + this.renderPrefetchLinks(context)
}

TemplateRenderer.prototype.getPreloadFiles = function getPreloadFiles(context) {
  var usedAsyncFiles = this.getUsedAsyncFiles(context)
  if (this.preloadFiles || usedAsyncFiles) {
    return (this.preloadFiles || []).concat(usedAsyncFiles)
  } else {
    return []
  }
}

TemplateRenderer.prototype.renderPreloadLinks = function renderPreloadLinks(
  context
) {
  var this$1 = this

  var files = this.getPreloadFiles(context)
  var shouldPreload = this.options.shouldPreload
  if (files.length) {
    return files
      .map(function(ref) {
        var file = ref.file
        var extension = ref.extension
        var fileWithoutQuery = ref.fileWithoutQuery
        var asType = ref.asType

        var extra = ''
        // by default, we only preload scripts or css
        if (!shouldPreload && asType !== 'script' && asType !== 'style') {
          return ''
        }
        // user wants to explicitly control what to preload
        if (shouldPreload && !shouldPreload(fileWithoutQuery, asType)) {
          return ''
        }
        if (asType === 'font') {
          extra = ' type="font/' + extension + '" crossorigin'
        }
        return (
          '<link rel="preload" href="' +
          this$1.publicPath +
          file +
          '"' +
          (asType !== '' ? ' as="' + asType + '"' : '') +
          extra +
          '>'
        )
      })
      .join('')
  } else {
    return ''
  }
}

TemplateRenderer.prototype.renderPrefetchLinks = function renderPrefetchLinks(
  context
) {
  var this$1 = this

  var shouldPrefetch = this.options.shouldPrefetch
  if (this.preloadFiles) {
    var usedAsyncFiles = this.getUsedAsyncFiles(context)
    var alreadyRendered = function(file) {
      return (
        usedAsyncFiles &&
        usedAsyncFiles.some(function(f) {
          return f.file === file
        })
      )
    }
    return this.prefetchFiles
      .map(function(ref) {
        var file = ref.file
        var fileWithoutQuery = ref.fileWithoutQuery
        var asType = ref.asType

        if (shouldPrefetch && !shouldPrefetch(fileWithoutQuery, asType)) {
          return ''
        }
        if (alreadyRendered(file)) {
          return ''
        }
        return '<link rel="prefetch" href="' + this$1.publicPath + file + '">'
      })
      .join('')
  } else {
    return ''
  }
}

TemplateRenderer.prototype.renderState = function renderState(
  context,
  options
) {
  var ref = options || {}
  var contextKey = ref.contextKey
  if (contextKey === void 0) contextKey = 'state'
  var windowKey = ref.windowKey
  if (windowKey === void 0) windowKey = '__INITIAL_STATE__'
  var state = this.serialize(context[contextKey])
  var autoRemove = ''
  var nonceAttr = context.nonce ? ' nonce="' + context.nonce + '"' : ''
  return context[contextKey]
    ? '<script' +
        nonceAttr +
        '>window.' +
        windowKey +
        '=' +
        state +
        autoRemove +
        '</script>'
    : ''
}

TemplateRenderer.prototype.renderScripts = function renderScripts(context) {
  var this$1 = this

  if (this.clientManifest) {
    var initial = this.preloadFiles.filter(function(ref) {
      var file = ref.file

      return isJS(file)
    })
    var async = (this.getUsedAsyncFiles(context) || []).filter(function(ref) {
      var file = ref.file

      return isJS(file)
    })
    var needed = [initial[0]].concat(async, initial.slice(1))
    return needed
      .map(function(ref) {
        var file = ref.file

        return '<script src="' + this$1.publicPath + file + '" defer></script>'
      })
      .join('')
  } else {
    return ''
  }
}

TemplateRenderer.prototype.getUsedAsyncFiles = function getUsedAsyncFiles(
  context
) {
  // if (!context._mappedFiles && context._registeredComponents && this.mapFiles) {
  //   var registered = Array.from(context._registeredComponents)
  //   context._mappedFiles = this.mapFiles(registered).map(normalizeFile)
  // }
  // return context._mappedFiles
  return []
}

function normalizeFile(file) {
  var withoutQuery = file.replace(/\?.*/, '')
  var extension = path$2.extname(withoutQuery).slice(1)
  return {
    file: file,
    extension: extension,
    fileWithoutQuery: withoutQuery,
    asType: getPreloadType(extension)
  }
}

function getPreloadType(ext) {
  if (ext === 'js') {
    return 'script'
  } else if (ext === 'css') {
    return 'style'
  } else if (/jpe?g|png|svg|gif|webp|ico/.test(ext)) {
    return 'image'
  } else if (/woff2?|ttf|otf|eot/.test(ext)) {
    return 'font'
  } else {
    // not exhausting all possibilities here, but above covers common cases
    return ''
  }
}

function extend(to, _from) {
  for (var key in _from) {
    to[key] = _from[key]
  }
  return to
}

function createRenderFunction() {
  return function(component, write, userContext, done) {
    write(component)
    done()
  }
}

function createWriteFunction(write, onError) {
  var cachedWrite = function(text) {
    write(text)
  }

  return cachedWrite
}

function createRenderer(ref) {
  if (ref === void 0) ref = {}

  var template = ref.template
  var shouldPreload = ref.shouldPreload
  var shouldPrefetch = ref.shouldPrefetch
  var clientManifest = ref.clientManifest
  var serializer = ref.serializer

  var render = createRenderFunction()

  var templateRenderer = new TemplateRenderer({
    template: template,
    shouldPreload: shouldPreload,
    shouldPrefetch: shouldPrefetch,
    clientManifest: clientManifest,
    serializer: serializer
  })

  return {
    renderToString: function renderToString(component, context, cb) {
      var assign

      if (typeof context === 'function') {
        cb = context
        context = {}
      }

      if (context) {
        templateRenderer.bindRenderFns(context)
      }

      // no callback, return Promise
      var promise
      if (!cb) {
        assign = createPromiseCallback()
        promise = assign.promise
        cb = assign.cb
      }

      var result = ''
      var write = createWriteFunction(function(text) {
        result += text
        return false
      }, cb)
      try {
        render(component, write, context, function(err) {
          if (err) {
            return cb(err)
          }
          if (template) {
            try {
              var res = templateRenderer.render(result, context)
              if (typeof res !== 'string') {
                // function template returning promise
                res
                  .then(function(html) {
                    return cb(null, html)
                  })
                  .catch(cb)
              } else {
                cb(null, res)
              }
            } catch (e) {
              cb(e)
            }
          } else {
            cb(null, result)
          }
        })
      } catch (e) {
        cb(e)
      }

      return promise
    }
  }
}

function createRenderer$1(options) {
  if (options === void 0) options = {}

  return createRenderer(extend({}, options))
}

function createBundleRendererCreator(createRenderer) {
  return function createBundleRenderer(bundle, rendererOptions) {
    if (rendererOptions === void 0) rendererOptions = {}
    debugger
    var files, entry, maps
    var basedir = rendererOptions.basedir
    // load bundle if given filepath
    if (
      typeof bundle === 'string' &&
      /\.js(on)?$/.test(bundle) &&
      path$2.isAbsolute(bundle)
    ) {
      if (fs.existsSync(bundle)) {
        var isJSON = /\.json$/.test(bundle)
        basedir = basedir || path$2.dirname(bundle)
        bundle = fs.readFileSync(bundle, 'utf-8')
        if (isJSON) {
          try {
            bundle = JSON.parse(bundle)
          } catch (e) {
            throw new Error('Invalid JSON bundle file: ' + bundle)
          }
        }
      } else {
        throw new Error('Cannot locate bundle file: ' + bundle)
      }
    }

    if (typeof bundle === 'object') {
      entry = bundle.entry
      files = bundle.files
      basedir = basedir || bundle.basedir
      if (typeof entry !== 'string' || typeof files !== 'object') {
        throw new Error(INVALID_MSG)
      }
    } else if (typeof bundle === 'string') {
      entry = '__vue_ssr_bundle__'
      files = { __vue_ssr_bundle__: bundle }
      maps = {}
    } else {
      throw new Error(INVALID_MSG)
    }

    if (!basedir) {
      throw new Error('basedir is undefined')
    }

    environment = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(basedir)
    )

    var renderer = createRenderer(rendererOptions)

    var run = createBundleRunner(entry, files)

    return {
      renderToString: function(context, cb) {
        var assign

        if (typeof context === 'function') {
          cb = context
          context = {}
        }

        var promise
        if (!cb) {
          assign = createPromiseCallback()
          promise = assign.promise
          cb = assign.cb
        }

        run(context)
          .catch(function(err) {
            cb(err)
          })
          .then(function(app) {
            if (app) {
              renderer.renderToString(app, context, function(err, res) {
                cb(err, res)
              })
            }
          })

        return promise
      }
    }
  }
}

var NativeModule = {
  wrap: function(code) {
    return code
  }
}

var vm = {
  Script: function(wrapper) {
    var tmpl = new nunjucks.Template(wrapper, environment, true)
    
    return function(context) {
      return tmpl.render(context)
    }
  }
}

function compileModule(files, basedir, runInNewContext) {
  var compiledScripts = Object.create(null)

  function getCompiledScript(filename) {
    if (compiledScripts[filename]) {
      return compiledScripts[filename]
    }
    var code = files[filename]
    var wrapper = NativeModule.wrap(code)
    var script = vm.Script(wrapper)

    compiledScripts[filename] = script
    return script
  }

  function evaluateModule(filename, evaluatedFiles) {
    if (evaluatedFiles === void 0) evaluatedFiles = {}

    if (evaluatedFiles[filename]) {
      return evaluatedFiles[filename]
    }

    var script = getCompiledScript(filename)

    res = script

    evaluatedFiles[filename] = res
    return res
  }

  return evaluateModule
}

function createBundleRunner(entry, files, basedir, runInNewContext) {
  var evaluate = compileModule(files, basedir, runInNewContext)

  var runner

  return function(userContext) {
    if (userContext === void 0) userContext = {}

    return new Promise(function(resolve) {
      if (!runner) {
        runner = evaluate(entry)
      }

      var raw = runner(userContext)

      resolve(raw)
    })
  }
}

var createBundleRenderer = createBundleRendererCreator(createRenderer$1)

exports.createRenderer = createRenderer$1
exports.createBundleRenderer = createBundleRenderer