/*eslint no-unused-vars:0*/
'use strict';

const logger = require('@financial-times/n-logger').default;
const fetchres = require('fetchres');
const raven = require('raven');
const path = require('path');
let ravenMiddleware;

function sendErrorDev (err, req, res, next) {
	let error;
	if (err instanceof Error) {
		error = {
			name: err.name,
			message: err.message
		};
		if (err.stack) {
			error.stack = err.stack.split('\n')
		}
	} else {
		error = err;
	}
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
			err = sanitiseError(err)
			return ravenMiddleware(err, req, res, next);
		}
	}
}

function getUpstreamErrorHandler (errorReporter) {
	return function (res, next, statusCode) {
		return function (err) {

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
	return function (err) {
		if (err.name === fetchres.ReadTimeoutError.name) {
			logger.error(err, { event: 'dependencytimeout' });
		} else {
			_captureError.apply(client, arguments);
		}
	};
}

function sanitiseError (err) {
	//Initially check for a specific email field e.g. in a url in an attempt to not blitz helpful error information if possible
	if (err.message) {
		const origErrorMsg = err.message
		const emailFieldRegex = 'email='
		const indxEmailField = origErrorMsg.search(emailFieldRegex)

		let cleanedErr = origErrorMsg
		if (indxEmailField > 0) {

			cleanedErr = origErrorMsg.slice(0,indxEmailField) + 'email=-redacted-'

			//in case there are more fields / is further at the end of the string
			let indexOfAdditionalParams = origErrorMsg.indexOf('&', indxEmailField)
			let indexOfPostURLspace = origErrorMsg.indexOf(' ', indxEmailField)

			if(indexOfAdditionalParams > 0) {
				cleanedErr = cleanedErr + origErrorMsg.slice(indexOfAdditionalParams, err.length)
			}
			else if (indexOfPostURLspace > 0){
				cleanedErr = cleanedErr + origErrorMsg.slice(indexOfPostURLspace, err.length)
			}

		}

		//The catch all check in case there are any remaining email addresses in the error
		const emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/g;

		if (cleanedErr) {
			cleanedErr = cleanedErr.replace(emailRegex, '-redacted-')
		}

		err.message = cleanedErr;
	}

	return err;
}

if (process.env.NODE_ENV === 'production') {

	let about;

	try {
		about = require(path.join(process.cwd(), 'public/__about.json'));
	} catch (e) {
		about = {};
	}

	const client = new raven.Client(process.env.RAVEN_URL, {
		release: about.appVersion || 'unknown',
		name: about.description || 'unknown',
		tags: {
			buildTime: about.buildCompletionTime || 'unknown'
		}
	});

	const _captureError = client.captureError;
	module.exports = client;
	module.exports.captureError = getCaptureError(client, _captureError);
	module.exports.middleware = sendErrorProd;
	module.exports.upstreamErrorHandler = getUpstreamErrorHandler(sendErrorProd);

	ravenMiddleware = raven.middleware.express(client);

	// Die on uncaughtException
	// https://github.com/getsentry/raven-node#catching-global-errors
	client.patchGlobal(function () {
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

module.exports.utils = raven.utils;
module.exports.transports = raven.transports;
module.exports.parsers = raven.parsers;
