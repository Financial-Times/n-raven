include n.Makefile

test: verify
	export NODE_ENV=development; mocha test/dev.spec;
	export NODE_ENV=production; mocha test/prod.spec
