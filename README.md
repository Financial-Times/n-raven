# express-error-handler

Some middleware for Express and Node that sets up Raven (or not as appropriate) depending on sensible environment variables.

## Usage

```js
var express = require('express');
var app = express();
var errorMiddleware = require('express-error-handler').middleware;

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

// Make sure the middleware is added after your routes otherwise 
app.use(errorMiddleware);
```

## Supported environment variables
- `NODE_ENV` - mode to operate in either `PRODUCTION`
- `RAVEN_URL` - URL to report bugs captured in production
