/*eslint no-unused-vars:0*/
'use strict';

const logger = require('@financial-times/n-logger').default;
const raven = require('raven');
const path = require('path');

function sanitiseError (err) {
	//Initially check for a specific email field e.g. in a url in an attempt to not blitz helpful error information if possible
	if (err.message) {
		const origErrorMsg = err.message;
		const emailFieldRegex = 'email=';
		const indxEmailField = origErrorMsg.search(emailFieldRegex);

		let cleanedErr = origErrorMsg;
		if (indxEmailField > 0) {

			cleanedErr = origErrorMsg.slice(0,indxEmailField) + 'email=-redacted-';

			//in case there are more fields / is further at the end of the string
			let indexOfAdditionalParams = origErrorMsg.indexOf('&', indxEmailField);
			let indexOfPostURLspace = origErrorMsg.indexOf(' ', indxEmailField);

			if(indexOfAdditionalParams > 0) {
				cleanedErr = cleanedErr + origErrorMsg.slice(indexOfAdditionalParams, err.length);
			}
			else if (indexOfPostURLspace > 0){
				cleanedErr = cleanedErr + origErrorMsg.slice(indexOfPostURLspace, err.length);
			}

		}

		//The catch all check in case there are any remaining email addresses in the error
		const emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/g;

		if (cleanedErr) {
			cleanedErr = cleanedErr.replace(emailRegex, '-redacted-');
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

	raven
		.config(process.env.RAVEN_URL, {
			release: about.appVersion || 'unknown',
			name: about.description || 'unknown',
			tags: {
				buildTime: about.buildCompletionTime || 'unknown'
			}
		})
		// Die on uncaughtException
		// https://docs.sentry.io/clients/node/usage/#global-fatal-error-handler
		.install(() => process.exit(1));

	// Support for the legacy captureError function.
	raven.captureError = raven.captureException;

	module.exports = raven;

	const _errorHandler = raven.errorHandler.bind(raven);
	module.exports.errorHandler = function () {
		const middleware = _errorHandler();
		return (err, req, res, next) => {
			logger.error(err, { event: 'uncaughterror' });
			if (req && res && next) {
				err = sanitiseError(err);
				return middleware(err, req, res, next);
			}
		};
	};

} else {

	module.exports = {
		context: func => func(),
		captureMessage: logger.warn.bind(logger),
		captureError: logger.error.bind(logger),
		captureException: logger.error.bind(logger),
		requestHandler: () => (req, res, next) => next(),
		errorHandler: () => (err, req, res, next) => {
			let error;
			if (err instanceof Error) {
				error = {
					name: err.name,
					message: err.message
				};
				if (err.stack) {
					error.stack = err.stack.split('\n');
				}
			} else {
				error = err;
			}
			logger.error(err, { event: 'uncaughterror' });
			res && res.status(500).send({ type: 'Uncaught Error', error: error });
		}
	};
}

module.exports.utils = raven.utils;
module.exports.transports = raven.transports;
module.exports.parsers = raven.parsers;
