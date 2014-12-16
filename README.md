# express-errors-handler

Some middleware for Express and Node that sets up Raven (or not as appropriate) depending on sensible environment variables.

## Installation

```sh
npm install --save express-errors-handler
```

## Usage

```js
var express = require('express');
var app = express();
var errorMiddleware = require('express-errors-handler').middleware;

var promiseEnabledApi = require('./my-promise-enabled-api');

// A typical route using Promises
app.get('/a-typical-route', function(req, res, next) {
	promiseEnabledApi.getSomeThings()
		.then(function(someThings) {
			res.render(someThings);
		})

		// Make sure to end all Promise chains with a `catch`
		// that passes the error to the next middleware
		.catch(next);
});

// Make sure the middleware is added after your routes otherwise you'll lose the errors
app.use(errorMiddleware);
```

## Supported environment variables
- `NODE_ENV` - mode to operate in, can be either `PRODUCTION` (sends bugs to aggregator) or any another value (shows bugs to user)
- `RAVEN_URL` - URL to report bugs captured in production

# License

This software is published by the Financial Times under the [MIT license](http://opensource.org/licenses/MIT).
