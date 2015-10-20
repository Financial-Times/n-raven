'use strict';

const expect = require('chai').expect;
const request = require('supertest');
const express = require('express');
const fetchres = require('fetchres');
const errorsHandler = require('../main');
const logger = require('ft-next-logger').logger;
const sinon = require('sinon');

describe('express errors handler in dev', function () {
	let app;
	const readTimeoutError = new fetchres.ReadTimeoutError();
	const badServerError = new fetchres.BadServerResponseError(418);

	const error = new Error('potato');
	before(function () {
		app = express();

		app.get('/caught-error', function (req, res, next) {
			next(error);
		});

		app.get('/timeout', function (req, res, next) {
			next(readTimeoutError);
		});

		app.get('/bad-response', function (req, res) {
			errorsHandler.upstreamErrorHandler(res, req, 513)(badServerError);
		});

		app.get('/not-bad-response', function (req, res) {
			errorsHandler.upstreamErrorHandler(res, req, 513)(error);
		});

		app.use(errorsHandler.middleware);
	});

	beforeEach(() => sinon.stub(logger, 'error'));
	afterEach(() => logger.error.restore())

	it('handle an arbitrary error', function (done) {
		request(app)
			.get('/caught-error')
			.end((err, res) => {
				expect(res.status).to.equal(500);
				expect(logger.error.calledWith('event=uncaughterror', error)).to.be.true;
				done();
			});
	});

	it('handle backend timeout', function (done) {
		request(app)
			.get('/timeout')
			.end((err, res) => {
				expect(res.status).to.equal(504);
				expect(logger.error.calledWith('event=dependencytimeout', readTimeoutError)).to.be.true;
				done();
			});
	});

	it('handle backend error with custom response', function (done) {
		request(app)
			.get('/bad-response')
			.end((err, res) => {
				expect(res.status).to.equal(513);
				expect(logger.error.calledWith('event=uncaughterror', badServerError)).to.be.true;
				done();
			});
	});

	it('handle non-matching error with default response', function (done) {
		request(app)
			.get('/not-bad-response')
			.end((err, res) => {
				expect(res.status).to.equal(500);
				expect(logger.error.calledWith('event=uncaughterror', error)).to.be.true;
				done();
			});
	});

});
