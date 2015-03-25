'use strict';

if (process.env.NODE_ENV === 'production') {
	var raven = require('raven');
	var client = new raven.Client(process.env.RAVEN_URL);
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
			console.log.apply(console, arguments);
		},
		captureError: function () {
			console.log.apply(console, arguments);
		},
		middleware: function(err, req, res, next) {
			console.log("Uncaught Error", err);
			console.log(err.stack);
			res.status(500).send({ type: "Uncaught Error", error: err });
			process.exit(1);
		}
	};
}
