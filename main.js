'use strict';

const logger = require('ft-next-logger').logger;
const fetchres = require('fetchres');
const raven = require('raven');
let ravenMiddleware;

function sendErrorDev (err, req, res) {
	if (err.name === fetchres.ReadTimeoutError.name) {
		logger.error('Dependency timeout -', err);
		res && res.status(504).send({ type: 'Bad Gateway', error: err });
	} else {
		logger.error('Uncaught Error -', err);
		res && res.status(500).send({ type: 'Uncaught Error', error: err });
		process.exit(1);
	}
}

function sendErrorProd (err, req, res) {
	if (err.name === fetchres.ReadTimeoutError.name) {
		logger.error('Dependency timeout -', err);
		res && res.status(504).send({ type: 'Bad Gateway', error: err });
	} else {
		return ravenMiddleware(err, req, res);
	}
}

function getUpstreamErrorHandler (errorReporter) {
	return function(res, statusCode) {
		return function(err) {
			if (err.name === fetchres.BadServerResponseError.name) {
				errorReporter(err);
				res.status(statusCode).end();
			} else {
				errorReporter(err, null, res);
			}
		};
	}
}

if (process.env.NODE_ENV === 'production') {
	const client = new raven.Client(process.env.RAVEN_URL);
	module.exports = client;
	module.exports.middleware = sendErrorProd;
	module.exports.upstreamErrorHandler = getUpstreamErrorHandler(sendErrorProd);
	ravenMiddleware = raven.middleware.express(client);

	// Die on uncaughtException
	// https://github.com/getsentry/raven-node#catching-global-errors
	client.patchGlobal(function() {
		process.exit(1);
	});
} else {

	module.exports = {
		captureMessage: logger.warn.bind(logger),
		captureError: logger.error.bind(logger),
		middleware: sendErrorDev,
		upstreamErrorHandler: getUpstreamErrorHandler(sendErrorDev)
	};
}
