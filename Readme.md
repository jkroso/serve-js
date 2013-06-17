
# serve-js

  handy development time middleware for projects which are written in the spirit of the commonjs module system. Its designed to integrate with a connect style static file server. It will filter requests looking for either a ".js" extension or an ".html". If it finds a ".js" it will send the corresponding file but with all its dependencies consolifated with it. Think of it like a runable tarball. If it finds a ".html" extension it looks at the corresponding file and if it has only one inline script tag it assumes you mean to compile the code inline and does so. This is a really nice feature if your creating a lot of small examples etc.. 

## Getting Started

_With npm_  

	$ npm install serve-js --save

then in your express/connect app:

```js
var serveJS = require('serve-js')
app.use(serveJS(process.cwd()))
```

## Examples

  for now just take a look at the tests.

## Running the tests

```bash
$ npm install
$ make test
$ open http://localhost:3000/test/inline.html
$ open http://localhost:3000/test/external.html
```
