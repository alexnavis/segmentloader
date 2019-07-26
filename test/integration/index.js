'use strict';
const chai = require('chai');
const expect = chai.expect;
const Promisie = require('promisie');
const MOCKS = require('../mocks');
const path = require('path');
const GENERATE = require(path.join(__dirname, '../../index'));

chai.use(require('chai-spies'));

describe('integration of population segment evaluators', function () {
  describe('generation of a single evaluator', function () {
    it('should be able to generate a single evaluator with a callback', async function () {
      let evaluator = await GENERATE.generateEvaluators(MOCKS.DEFAULT);
      expect(evaluator).to.be.a('function');
    });
  });
  describe('generation of an array of evaluators', function () {
    it('should be able to generate a single evaluator with a callback', async function () {
      let evaluators = await GENERATE.generateEvaluators([MOCKS.DEFAULT, MOCKS.DEFAULT_DUPLICATE]);
      expect(evaluators).to.be.an('object');
      expect(evaluators).to.have.property('segment_1');
      expect(evaluators).to.have.property('segment_2');
    });
  });
  describe('handling errors in generation process', function () {
    it('should handle an error when no callback is passed', done => {
      GENERATE.generateEvaluators(null)
        .then(() => {
          done(new Error('should not execute'));
        }, e => {
          expect(e).to.be.instanceof(Error);
          done();
        });
    });
  });
});