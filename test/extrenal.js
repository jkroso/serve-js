var mocha = require('mocha')

mocha.setup('bdd')

require('./serve-js.test')

mocha.run(function(){
	console.log('Done!')
})