
var detective = require('detective')
  , Graph = require('sourcegraph')
  , Compiler = require('bigfile')
  , cheerio = require('cheerio')
  , path = require('path')
  , dirname = path.dirname
  , join = path.join
  , fs = require('fs')
  , exists = fs.existsSync

module.exports = function(base, opts){
	var graph = new Graph()
		.use('nodeish')
		.use('stylus')
		.use('mocha')
		.use('jade')
		.use('css')

	var build = new Compiler(path.basename(base))
		.plugin('nodeish')
		.plugin('stylus')
		.plugin('jade')
		.plugin('css')
		.use('transform')
		.use('quick-path-shorten')
		.use('development')
		.use('umd')
		.use(function(code){
			this.end(code)
		})

	return function(req, res, next){
		if (req.method != 'GET') return next()
		var url = req.url.split('?')[0]
		var path = join(base, url)
		var type = extension(path)

		// javascript file
		if (type == 'js' && exists(path)) {
			return graph.clear()
				.add(path)
				.then(values)
				.then(function(files){
					build.end = function(code){
						res.setHeader('Content-Type', 'application/javascript')
						res.setHeader('Content-Length', Buffer.byteLength(code, 'utf8'))
						res.end(code)
					}
					build.entry = path
					build.send(files)
				}).read(null, next)
		}

		// handle embeded js
		if (type == 'html' && exists(path)) {
			var html = fs.readFileSync(path)
			var $ = cheerio.load(html)
			var scripts = $('script')
			var script = scripts[0]
			if (scripts.length == 1 && typeof script.attribs.src != 'string') {
				graph.clear()
				script = script.children[0].data
				// remove indentation
				if ((/\n([ \t]+)[^\s]/).test(script)) {
					script = script.replace(new RegExp('^' + RegExp.$1, 'mg'), '')
				}
				try { var requires = detective(script) }
				catch (e) {
					e.message += ' in the <script> of ' + path
					return next(e)
				}
				var file = graph.graph[path] = {
					path: path + '.js',
					text: script,
					parents: [],
					children: [],
					aliases: [ path ],
					base: dirname(path),
					requires: requires
				}
				return graph.trace(file).then(function(){
					build.entry = path
					build.end = function send(code){
						scripts[0].children[0].data = code
						var html = $.html()
						res.setHeader('Content-Type', 'text/html; charset=utf-8')
						res.setHeader('Content-Length', Buffer.byteLength(html, 'utf8'))
						res.end(html)
					}
					build.send(values(graph.graph))
				}).read(null, next)
			}
		}
		
		next()
	}
}

function values(obj){
	var vals = []
	for (var k in obj) vals.push(obj[k])
	return unique(vals)
}

function unique(arr) {
  var len = arr.length
  if (!len) return []

  var result = [arr[0]]
  var rc = 1
  var i = 1

  each: while (i < len) {
    var el = arr[i++]
    var c = 0

    while (c < rc) {
      if (result[c++] === el) continue each
    }

    result[rc++] = el
  }

  return result
}

function extension(file){
	return path.extname(file).slice(1)
}