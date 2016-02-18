/*eslint no-unused-vars:0*/
'use strict';

const logger = require('@financial-times/n-logger').default;
const fetchres = require('fetchres');
const raven = require('raven');
let ravenMiddleware;

function sendErrorDev (err, req, res, next) {
	const error = (err instanceof Error) ?
		{
			name: err.name,
			message: err.message,
			stack: err.stack.split('\n')
		} :
		err;
	if (err.name === fetchres.ReadTimeoutError.name) {
		logger.error(err, { event: 'dependencytimeout' });
		res && res.status(504).send({ type: 'Bad Gateway', error: error });
	} else {
		logger.error(err, { event: 'uncaughterror' });
		res && res.status(500).send({ type: 'Uncaught Error', error: error });
	}
}

function sendErrorProd (err, req, res, next) {
	if (err.name === fetchres.ReadTimeoutError.name) {
		logger.error(err, { event: 'dependencytimeout' });
		res && res.status(504).send({ type: 'Bad Gateway', error: err });
	} else {
		logger.error(err, { event: 'uncaughterror' });
		if (req && res && next) {
			return ravenMiddleware(err, req, res, next);
		}
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

function getCaptureError (client, _captureError) {
	return function(err) {
		if (err.name === fetchres.ReadTimeoutError.name) {
			logger.error(err, { event: 'dependencytimeout' });
		} else {
			_captureError.apply(client, arguments);
		}
	};
}

if (process.env.NODE_ENV === 'production') {
	const client = new raven.Client(process.env.RAVEN_URL);
	const _captureError = client.captureError;
	module.exports = client;
	module.exports.captureError = getCaptureError(client, _captureError);
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
