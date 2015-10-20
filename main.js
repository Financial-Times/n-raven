/*eslint no-unused-vars:0*/
'use strict';

const logger = require('ft-next-logger').logger;
const fetchres = require('fetchres');
const raven = require('raven');
let ravenMiddleware;

function sendErrorDev (err, req, res, next) {
	if (err.name === fetchres.ReadTimeoutError.name) {
		logger.error('event=dependencytimeout', err);
		res && res.status(504).send({ type: 'Bad Gateway', error: err });
	} else {
		logger.error('event=uncaughterror', err);
		res && res.status(500).send({ type: 'Uncaught Error', error: err });
	}
}

function sendErrorProd (err, req, res, next) {
	if (err.name === fetchres.ReadTimeoutError.name) {
		logger.error('event=dependencytimeout', err);
		res && res.status(504).send({ type: 'Bad Gateway', error: err });
	} else if (req && res && next) {
		return ravenMiddleware(err, req, res, next);
	} else {
		logger.error('event=uncaughterror', err);
	}
}

function getUpstreamErrorHandler (errorReporter) {
	return function(res, next, statusCode) {
		return function(err) {

			if (err.name === fetchres.BadServerResponseError.name) {
				errorReporter(err);
				res.status(statusCode).end();
			} else {
				next(err);
			}
		};
	};
}

function getCaptureError (client) {
	return function(err) {
		if (err.name === fetchres.ReadTimeoutError.name) {
			logger.error('event=dependencytimeout', err);
		} else {
			client.captureError.apply(client, arguments);
		}
	};
}

if (process.env.NODE_ENV === 'production') {
	const client = new raven.Client(process.env.RAVEN_URL);
	module.exports = Object.assign({}, client);
	module.exports.captureError = getCaptureError(client);
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
