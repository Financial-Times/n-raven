.PHONY: test

install:
	npm install

test:
	export NODE_ENV=development; mocha test/dev.spec;
	export NODE_ENV=production; mocha test/prod.spec
	nbt verify --skip-layout-checks
