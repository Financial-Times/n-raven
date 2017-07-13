'use strict';
const expect = require('chai').expect;
const request = require('supertest');
const express = require('express');
const fetchres = require('fetchres');

const logger = require('@financial-times/n-logger').default;
const sinon = require('sinon');
const raven = require('raven');

describe('express errors handler in prod', function () {
	let app;
	let errorsHandler;
	const readTimeoutError = new fetchres.ReadTimeoutError();
	const badServerError = new fetchres.BadServerResponseError(418);
	const errorToPassThrough = new Error('potato');
	const ravenSpy = sinon.spy(function (err, req, res, next) {
		next(err, req, res);
	});
	const captureErrorSpy = sinon.spy();
	const captureMessageSpy = sinon.spy();

	before(function () {
		sinon.stub(raven.middleware, 'express', () => ravenSpy);

		const clientStub = function () {};
		clientStub.prototype.captureMessage = captureMessageSpy;
		clientStub.prototype.captureError = captureErrorSpy;
		clientStub.prototype.patchGlobal = sinon.spy();

		sinon.stub(raven, 'Client', clientStub);
		errorsHandler = require('../main');
		app = express();

		app.get('/caught-error', function (req, res, next) {
			next(errorToPassThrough);
		});

		app.get('/timeout', function (req, res, next) {
			next(readTimeoutError);
		});

		app.get('/bad-response', function (req, res, next) {
			errorsHandler.upstreamErrorHandler(res, next, 513)(badServerError);
		});

		app.get('/not-bad-response', function (req, res, next) {
			errorsHandler.upstreamErrorHandler(res, next, 513)(errorToPassThrough);
		});
		app.use(errorsHandler.middleware);
	});


	beforeEach(() => sinon.stub(logger, 'error'));
	afterEach(() => {
		logger.error.restore();
		ravenSpy.reset();
	});

	it('handle an arbitrary error', function (done) {
		request(app)
			.get('/caught-error')
			.end((err, res) => {
				expect(res.status).to.equal(500);
				expect(logger.error.callCount).to.equal(1);
				expect(logger.error.calledWith(errorToPassThrough, { event: 'uncaughterror'})).to.be.true;
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
				expect(logger.error.calledWith(readTimeoutError, { event: 'dependencytimeout'})).to.be.true;
				done();
			});
	});

	it('handle backend error with custom response', function (done) {
		request(app)
			.get('/bad-response')
			.end((err, res) => {
				expect(res.status).to.equal(513);
				expect(ravenSpy.called).to.be.false;
				expect(logger.error.calledWith(badServerError, { event: 'uncaughterror'})).to.be.true;
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
				expect(logger.error.calledWith(errorToPassThrough, { event: 'uncaughterror'})).to.be.true;
				done();
			});
	});

	it('can capture errors outside of express controllers', function () {
		errorsHandler.captureError(readTimeoutError);
		expect(logger.error.calledWith(readTimeoutError, { event: 'dependencytimeout'})).to.be.true;

		errorsHandler.captureError(badServerError);
		expect(captureErrorSpy.called).to.be.true;
		expect(captureErrorSpy.args[0].length).to.equal(1);
		expect(captureErrorSpy.args[0][0].name).to.equal(badServerError.name);
	});

	it('can capture messages outside of express controllers', function () {
		errorsHandler.captureMessage('random message');

		expect(captureMessageSpy.called).to.be.true;
		expect(captureMessageSpy.args[0].length).to.equal(1);
		expect(captureMessageSpy.args[0][0]).to.equal('random message');
	});

	describe('it does not affect strings with no email addresses in them and ', () => {
		it('works with a blank error msg', function (done) {
			const blankErr = ' ';

			errorToPassThrough.message = ' ';

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(blankErr);
					done();
				});
		});

		it('works with a string with an already clean message in it', function (done) {
			const cleanErrorMsg = 'A clean error message';

			errorToPassThrough.message = cleanErrorMsg;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(cleanErrorMsg);
					done();
				});
		});
	});

	describe('it works at removing email addresses from errors when there is ', () => {
		it('a single email address part way through the message', (done) => {
			const errorWithSingleEmailAdd = 'An error with a single email address daffy.duck@ft.com part way through it';
			const errorWithSingleEmailAddRemoved = 'An error with a single email address -redacted- part way through it';

			errorToPassThrough.message = errorWithSingleEmailAdd;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(errorWithSingleEmailAddRemoved);
					done();
				});
		});

		it('a single email address part way through the message', (done) => {
			const errorWithSingleEmailAdd = 'An error with a single email address daffy@ft.com';
			const errorWithSingleEmailAddRemoved = 'An error with a single email address -redacted-';

			errorToPassThrough.message = errorWithSingleEmailAdd;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(errorWithSingleEmailAddRemoved);
					done();
				});
		});


		it('a single email address part way through the message', (done) => {
			const errorWithSingleEmailAdd = 'daffy.duck@ft.com An error with a single email address';
			const errorWithSingleEmailAddRemoved = '-redacted- An error with a single email address';

			errorToPassThrough.message = errorWithSingleEmailAdd;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(errorWithSingleEmailAddRemoved);
					done();
				});
		});

		it('multiple email addresses in the message', (done) => {
			const errorWithMultipleEmailAdd = 'An error with multiple email daffy.duck@ft.com addresses daffy.duck.2@ft.com and text after';
			const errorWithMultipleEmailAddRemoved = 'An error with multiple email -redacted- addresses -redacted- and text after';

			errorToPassThrough.message = errorWithMultipleEmailAdd;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(errorWithMultipleEmailAddRemoved);
					done();
				});
		});

		it('a single email address in a url with addition params', (done) => {
			const errorWithUrlEmail = 'An error with a url containing an email address like this http://some-api.ft.com?email=daffy.duck@ft.com&other=xyz';
			const errorWithUrlEmailRemoved = 'An error with a url containing an email address like this http://some-api.ft.com?email=-redacted-&other=xyz';

			errorToPassThrough.message = errorWithUrlEmail;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(errorWithUrlEmailRemoved);
					done();
				});
		});

		it('a single email address in a url with additional text after it', (done) => {
			const errorWithUrlEmail = 'An error with a url containing an email address like this http://some-api.ft.com?email=daffy.duck@ft.com etc etc';
			const errorWithUrlEmailRemoved = 'An error with a url containing an email address like this http://some-api.ft.com?email=-redacted- etc etc';

			errorToPassThrough.message = errorWithUrlEmail;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(errorWithUrlEmailRemoved);
					done();
				});
		});

		it('a single email address in a url with addition params and text', (done) => {
			const errorWithUrlEmail = 'An error with a url containing an email address like this http://some-api.ft.com?email=daffy.duck@ft.com&other=xyz etc etc';
			const errorWithUrlEmailRemoved = 'An error with a url containing an email address like this http://some-api.ft.com?email=-redacted-&other=xyz etc etc';

			errorToPassThrough.message = errorWithUrlEmail;

			request(app)
				.get('/caught-error')
				.end((err, res) => {
					expect(res.status).to.equal(500);
					expect(ravenSpy.called).to.be.true;
					expect(ravenSpy.args[0][0].message).to.equal(errorWithUrlEmailRemoved);
					done();
				});
		});
	});

});
