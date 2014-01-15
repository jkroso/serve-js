
var filter = Function.call.bind([].filter)
var detective = require('detective')
var each = require('foreach/series')
var Graph = require('sourcegraph')
var Compiler = require('bigfile')
var cheerio = require('cheerio')
var path = require('path')
var dirname = path.dirname
var join = path.join
var fs = require('fs')
var exists = fs.existsSync

module.exports = function(base, opts){
  var globalGraph = new Graph()
    .use('nodeish')
    .use('stylus')
    .use('mocha')
    .use('jade')
    .use('css')

  var build = new Compiler(path.basename(base))
    .plugin('nodeish')
    .plugin('stylus')
    .plugin('jade')
    .plugin('html')
    .plugin('css')
    .use('transform')
    .use('development')
    .use('invoke')

  return function(req, res, next){
    if (req.method != 'GET') return next()
    var url = req.url.split('?')[0]
    var path = join(base, url)
    var type = extension(path)
    var graph = Object.create(globalGraph)

    // javascript file
    if (type == 'js' && exists(path)) {
      return graph.clear().add(path).then(function(graph){
        // need to alias the entry so both the compiled and
        // original can show up in the web inspector
        build.entry = path.replace(/js$/, 'original.js')
        var entry = graph[path]
        entry.aliases.push(path)
        entry.path = build.entry

        return build.send(values(graph)).then(function(code){
          res.setHeader('Content-Type', 'application/javascript')
          res.setHeader('Content-Length', Buffer.byteLength(code, 'utf8'))
          res.end(code)
        })
      }).read(null, next)
    }

    // handle embeded js
    if (type == 'html' && exists(path)) {
      var html = fs.readFileSync(path, 'utf8')
      var $ = cheerio.load(html)
      var scripts = filter($('script'), function(script){
        return typeof script.attribs.src != 'string'
      })
      if (!scripts.length) return next()

      return each(scripts, function(script, i){
        if (!script.children.length) return
        var src = script.children[0].data || ''
        var offset = html
          .slice(0, html.indexOf(src))
          .split(/\n/).length - 1
        // remove indentation
        if ((/\n([ \t]+)[^\s]/).test(src)) {
          src = src.replace(new RegExp('^' + RegExp.$1, 'mg'), '')
        }
        var requires
        try { requires = detective(src) }
        catch (e) {
          e.message += ' in the <script> of ' + path
          throw e
        }
        graph.clear()
        var entry = path + '-' + (i + 1) + '.js'
        var file = graph.graph[path] = {
          path: entry,
          text: src,
          parents: [],
          children: [],
          aliases: [ path ],
          base: dirname(path),
          requires: requires
        }
        return graph.trace(file).then(function(){
          build.entry = entry
          build.offsetScript = offset
          return build.send(values(graph.graph)).then(function(code){
            build.offsetScript = 0
            script.children[0].data = code
            html = $.html()
          })
        })
      }).then(function(){
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Content-Length', Buffer.byteLength(html, 'utf8'))
        res.end(html)
      }).read(null, next)
    }
    
    next()
  }
}

function values(obj){
  var vals = []
  for (var k in obj) {
    if (vals.indexOf(obj[k]) < 0) vals.push(obj[k])
  }
  return vals
}

function extension(file){
  return path.extname(file).slice(1)
}
