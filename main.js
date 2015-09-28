'use strict';

const logger = require('ft-next-logger');

if (process.env.NODE_ENV === 'production') {
	const raven = require('raven');
	const client = new raven.Client(process.env.RAVEN_URL);
	module.exports = client;
	module.exports.middleware = raven.middleware.express(client);

	// Die on uncaughtException
	// https://github.com/getsentry/raven-node#catching-global-errors
	client.patchGlobal(function() {
		process.exit(1);
	});
} else {
	module.exports = {
		captureMessage: function () {
			logger.warn.apply(logger, arguments);
		},
		captureError: function () {
			logger.warn.apply(logger, arguments);
		},
		middleware: function(err, req, res) {
			logger.error('Uncaught Error -', err);
			res.status(500).send({ type: 'Uncaught Error', error: err });
			process.exit(1);
		}
	};
}
