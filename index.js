
var filter = Function.call.bind([].filter)
var File = require('sourcegraph/file')
var each = require('foreach/series')
var graph = require('sourcegraph')
var cheerio = require('cheerio')
var build = require('bigfile')
var Result = require('result')
var path = require('path')
var fs = require('fs')
var exists = fs.existsSync
var when = Result.when
var read = Result.read
var join = path.join

module.exports = function(base, opts){
  return function(req, res, next){
    if (req.method != 'GET') return next()
    var url = req.url.split('?')[0]
    var path = join(base, url)
    var type = extension(path)

    // javascript file
    if (type == 'js' && exists(path)) {
      return read(graph(path), function(files){
        var code = build(files)
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Content-Length', Buffer.byteLength(code, 'utf8'))
        res.end(code)
      }, next)
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

        var file = new File(path + '-' + (i + 1) + '.js')
        file.aliases = [ path ]
        file.javascript = src

        return when(graph(file), function(files){
          var code = build(files, offset)
          script.children[0].data = code
          html = $.html()
        })
      }).then(function(){
        var buf = new Buffer(html, 'utf8')
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Content-Length', buf.length)
        res.end(buf)
      }).read(null, next)
    }

    next()
  }
}

function extension(file){
  return path.extname(file).slice(1)
}
