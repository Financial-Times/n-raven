'use strict';
const expect = require('chai').expect;
const request = require('supertest');
const express = require('express');
const fetchres = require('fetchres');

const logger = require('ft-next-logger').logger;
const sinon = require('sinon');
const raven = require('raven');

describe('express errors handler in prod', function () {
	let app;
	let errorsHandler;
	const readTimeoutError = new fetchres.ReadTimeoutError();
	const badServerError = new fetchres.BadServerResponseError(418);
	const error = new Error('potato');
	const ravenSpy = sinon.spy(function (err, req, res, next) {
		next(err, req, res);
	});
	const captureErrorSpy = sinon.spy();

	before(function () {
		sinon.stub(raven.middleware, 'express', () => ravenSpy);
		sinon.stub(raven, 'Client', () => {
			return {
				captureError: captureErrorSpy,
				patchGlobal: sinon.spy()
			}
		});
		errorsHandler = require('../main');
		app = express();

		app.get('/caught-error', function (req, res, next) {
			next(error);
		});

		app.get('/timeout', function (req, res, next) {
			next(readTimeoutError);
		});

		app.get('/bad-response', function (req, res, next) {
			errorsHandler.upstreamErrorHandler(res, next, 513)(badServerError);
		});

		app.get('/not-bad-response', function (req, res, next) {
			errorsHandler.upstreamErrorHandler(res, next, 513)(error);
		});
		app.use(errorsHandler.middleware);
	});

	beforeEach(() => sinon.stub(logger, 'error'));
	afterEach(() => {
		logger.error.restore();
		ravenSpy.reset();
	})

	it('handle an arbitrary error', function (done) {
		request(app)
			.get('/caught-error')
			.end((err, res) => {
				expect(res.status).to.equal(500);
				expect(logger.error.calledWith('event=uncaughterror', error)).to.be.false;
				expect(ravenSpy.called).to.be.true;
				expect(ravenSpy.args[0].length).to.equal(4);
				done();
			});
	});

	it('handle backend timeout', function (done) {
		request(app)
			.get('/timeout')
			.end((err, res) => {
				expect(res.status).to.equal(504);
				expect(ravenSpy.called).to.be.false;
				expect(logger.error.calledWith('event=dependencytimeout', readTimeoutError)).to.be.true;
				done();
			});
	});

	it('handle backend error with custom response', function (done) {
		request(app)
			.get('/bad-response')
			.end((err, res) => {
				expect(res.status).to.equal(513);
				expect(ravenSpy.called).to.be.false;
				expect(logger.error.calledWith('event=uncaughterror', badServerError)).to.be.true;
				done();
			});
	});

	it('handle non-matching error with default response', function (done) {
		request(app)
			.get('/not-bad-response')
			.end((err, res) => {
				expect(res.status).to.equal(500);
				expect(ravenSpy.called).to.be.true;
				expect(ravenSpy.args[0].length).to.equal(4);
				expect(logger.error.calledWith('event=uncaughterror', error)).to.be.false;
				done();
			});
	});

	it('can capture errors outside of express controllers', function () {
		errorsHandler.captureError(readTimeoutError);
		expect(logger.error.calledWith('event=dependencytimeout', readTimeoutError)).to.be.true;

		errorsHandler.captureError(badServerError);
		expect(captureErrorSpy.called).to.be.true;
		expect(captureErrorSpy.args[0].length).to.equal(1);
		expect(captureErrorSpy.args[0][0].name).to.equal(badServerError.name);
	});
});