node_modules/@financial-times/n-gage/index.mk:
	npm install --no-save --no-package-lock @financial-times/n-gage
	touch $@

-include node_modules/@financial-times/n-gage/index.mk

test: verify
	export NODE_ENV=development; mocha --exit test/dev.spec;
	export NODE_ENV=production; mocha --exit test/prod.spec
