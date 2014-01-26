
var hydro = new(require('hydro'))

hydro.set({
  formatter: require('hydro-html'),
  plugins: [ require('hydro-bdd') ]
})

hydro.setup()

require('./serve-js.test')

hydro.run()
