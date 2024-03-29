# Next Raven [![Circle CI](https://circleci.com/gh/Financial-Times/n-raven.svg?style=svg)](https://circleci.com/gh/Financial-Times/n-raven)

Some middleware for Express and Node that sets up Raven (or not as appropriate) depending on sensible environment variables.

**This wrapper is FT.com-specific; apps maintained by teams outside of Customer Products should [use `@sentry/node` directly](https://docs.sentry.io/platforms/node/guides/express/).**

## Installation

```sh
npm install --save @financial-times/n-raven
```

## Usage

```js
const express = require('express');
const app = express();
const nRaven = require('@financial-times/n-raven')

const promiseEnabledApi = require('./my-promise-enabled-api');

// must come before all routes
app.use(nRaven.requestHandler);

// A typical route using Promises
app.get('/a-typical-route', async function(req, res, next) {
	try {
		const someThings = await promiseEnabledApi.getSomeThings()

		res.render(someThings);
	} catch(error) {
		// Make sure to end all async functions with a `catch`
		// that passes the error to the next middleware
		next(error);
	}
});

// must come after every route
app.use(nRaven.errorHandler);
```

### Suppressing error logging

By default the raven error handler logs error details as well as sending error information to Sentry. You can suppress this behaviour by setting `response.locals.suppressRavenLogger` to `true` in any route before raven's error handler is registered.

## Supported environment variables
- `NODE_ENV` - mode to operate in, can be either `PRODUCTION` (sends bugs to aggregator) or any another value (shows bugs to user)
- `RAVEN_URL` - URL to report bugs captured in production
- `SPLUNK_URL` - URL to send non critical or upstream bugs too

# License

This software is published by the Financial Times under the [MIT license](http://opensource.org/licenses/MIT).
