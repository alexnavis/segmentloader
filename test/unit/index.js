'use strict';
const chai = require('chai');
const expect = chai.expect;
const Promisie = require('promisie');
const MOCKS = require('../mocks');
const path = require('path');
const CREATE_EVALUATOR = require(path.join(__dirname, '../../lib/evaluators'));

chai.use(require('chai-spies'));

describe('calculations module', function () {
  describe('basic assumptions', function () {
    it('should have a create method that is a function', () => {
      expect(CREATE_EVALUATOR).to.be.a('function');
    });
    it('should accept a segment as an arguments and generate an evaluator', () => {
      let evaluator = CREATE_EVALUATOR(MOCKS.DEFAULT);
      expect(evaluator).to.be.a('function');
    });
  });
  describe('evaluation of a simple population segment', function () {
    let evaluation;
    before(done => {
      evaluation = CREATE_EVALUATOR(MOCKS.DEFAULT, false, '1');
      done();
    });
    it('should return a result object for a passing population segment', async function () {
      let result = await evaluation({
        today: new Date().toISOString(),
        age: 15,
        ageMin: 1,
        ageMax: 16,
        compareage: 11,
        dobstart: new Date('1960-01-01').toISOString(),
        dobend: new Date('1993-09-03').toISOString(),
        dob: new Date('1992-09-02').toISOString(),
        state: 'NJ',
      });
      expect(result).to.be.an('object');
      expect(result).to.have.property('conditions');
      expect(result).to.have.property('name');
    })
    it('should return false for a failing population segment', async function () {
      let result = await evaluation({
        today: new Date().toISOString(),
        age: 15,
        ageMin: 1,
        ageMax: 16,
        compareage: 21,
        dobstart: new Date('1960-01-01').toISOString(),
        dobend: new Date('1993-09-03').toISOString(),
        dob: new Date('1992-09-02').toISOString(),
        state: 'NJ',
      });
      expect(result).to.equal(false);
    })
    it('should return an error when a required variable is not available on state', async function () {
      let result = await evaluation({
        today: new Date().toISOString(),
        age: 15,
        ageMin: 1,
        ageMax: 16,
        compareage: 21,
        // dobstart: new Date('1960-01-01').toISOString(),
        dobend: new Date('1993-09-03').toISOString(),
        dob: new Date('1992-09-02').toISOString(),
        state: 'NJ',
      });
      expect(result).to.be.an('object');
      expect(result.message).to.be.a('string');
      expect(result.message).to.equal('The Variable dobstart is required by a Rule but is not defined.');
    })
  })
});