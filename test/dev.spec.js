'use strict';

const expect = require('chai').expect;
const request = require('supertest');
const express = require('express');
const nRaven = require('../main');
const logger = require('@financial-times/n-logger').default;
const sinon = require('sinon');

describe('express errors handler in dev', function () {
	let app;

	const error = new Error('potato');
	before(function () {
		app = express();
		app.use(nRaven.requestHandler());
		app.get('/caught-error', function (req, res, next) {
			next(error);
		});

		app.use(nRaven.errorHandler());
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
});
