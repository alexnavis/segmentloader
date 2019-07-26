'use strict';
const path = require('path');
const createEvaluator = require(path.join(__dirname, './lib/evaluators'));
const Promisie = require('promisie');

/**
 * Creates segement evaluators from configurations
 * @param {Object|Object[]} configurations A single configuration object or an array of configuration objects
 * @return {Object|Function} A single evaluator or an object containing evalutors indexed by name
 */
var generateEvaluators = function (configurations) {
  try {
    if (!configurations) throw new Error('No configurations available to evaluate');
    if (!Array.isArray(configurations)) return createEvaluator(configurations);
    return configurations.reduce((result, configuration) => {
      result[configuration.name] = createEvaluator(configuration);
      return result;
    }, {});
  } catch (e) {
    return Promisie.reject(e); 
  }
};

/**
 * Given a set of evaluations returns a function that will return segment information once it finds a segment that passes given state data
 * @param {Object} segment_evaluations An object indexed by segment name that contains evaluator functions
 * @param {boolean} multi If true evaluate will return array of valid segments
 * @return {Function} Segment evaluator
 */
var evaluate = function (segment_evaluations, multi) {
  /**
   * Given state and options default data function will return segment information once a passing condition is returned
   * @param {Object} input Optional default data this argument will be used as state if state argument is not passed
   * @param {Object} state State data this argument only needs to be passed if not passing default data as the input argument
   * @return {Object} Segment data for a passing segment
   */
  return function segment_evaluator(input, state) {
    let segment = (multi) ? [] : undefined;
    let _state = (state && typeof state === 'object') ? Object.assign({}, state) : Object.assign({}, input);
    for (let key in segment_evaluations) {
      let passes = segment_evaluations[key](input, _state);
      if (passes && !multi) {
        segment = passes;
        break;
      } else if (passes && multi) segment.push(passes);
    }
    return segment;
  };
};

module.exports = { evaluate, generateEvaluators, };