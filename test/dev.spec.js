'use strict';

const expect = require('chai').expect;
const request = require('supertest');
const express = require('express');
const fetchres = require('fetchres');
const errorsHandler = require('../main');
const logger = require('@financial-times/n-logger').default;
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
	afterEach(() => logger.error.restore());

	it('handle an arbitrary error', () => {
		return request(app)
			.get('/caught-error')
			.expect(500)
			.expect(res => {
				const body = res.body;
				expect(body).to.have.property('type', 'Uncaught Error');
				expect(body).to.contain.keys('error');
				expect(body.error).to.have.property('name', 'Error');
				expect(body.error).to.have.property('message', 'potato');
				expect(body.error).to.contain.keys('stack');
				expect(body.error.stack[0]).to.equal('Error: potato');
				expect(logger.error.calledWith(error, { event: 'uncaughterror' })).to.be.true;
			});
	});

	it('handle backend timeout', () => {
		return request(app)
			.get('/timeout')
			.expect(504)
			.expect(res => {
				const body = res.body;
				expect(body).to.have.property('type', 'Bad Gateway');
				expect(body).to.contain.keys('error');
				expect(body.error).to.have.property('name', 'ReadTimeoutError');
				expect(logger.error.calledWith(readTimeoutError, { event: 'dependencytimeout' })).to.be.true;
			});
	});

	it('handle backend error with custom response', () => {
		return request(app)
			.get('/bad-response')
			.expect(513)
			.expect(() => {
				expect(logger.error.calledWith(badServerError, { event: 'uncaughterror' })).to.be.true;
			});
	});

	it('handle non-matching error with default response', () => {
		return request(app)
			.get('/not-bad-response')
			.expect(500)
			.expect(res => {
				const body = res.body;
				expect(body).to.have.property('type', 'Uncaught Error');
				expect(body).to.contain.keys('error');
				expect(body.error).to.have.property('name', 'TypeError');
				expect(body.error).to.have.property('message', 'next is not a function');
				expect(body.error).to.contain.keys('stack');
				expect(body.error.stack[0]).to.equal('TypeError: next is not a function');
				expect(logger.error.calledWith(error, { event: 'uncaughterror' })).to.be.true;
			});
	});

});
