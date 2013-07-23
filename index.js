
var detective = require('detective')
  , each = require('foreach/series')
  , Graph = require('sourcegraph')
  , Compiler = require('bigfile')
  , cheerio = require('cheerio')
  , path = require('path')
  , dirname = path.dirname
  , join = path.join
  , fs = require('fs')
  , filter = Array.prototype.filter
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
					build.entry = path
					return build.send(files).then(function(code){
						res.setHeader('Content-Type', 'application/javascript')
						res.setHeader('Content-Length', Buffer.byteLength(code, 'utf8'))
						res.end(code)
					})
				}).read(null, next)
		}

		// handle embeded js
		if (type == 'html' && exists(path)) {
			var $ = cheerio.load(fs.readFileSync(path, 'utf8'))
			var scripts = filter.call($('script'), function(script){
				return typeof script.attribs.src != 'string'
			})
			if (scripts.length) return each(scripts, function(script, i){
				if (!script.children.length) return
				var src = script.children[0].data || ''
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
					return build.send(values(graph.graph)).then(function(code){
						// console.log(code)
						script.children[0].data = code
					})
				})
			}).then(function(){
				var html = $.html()
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