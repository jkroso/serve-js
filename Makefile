
test: node_modules
	node_modules/serve/bin/serve -m ./test/mw.js

node_modules: package.json
	packin install -m package.json -f node_modules

.PHONY: test