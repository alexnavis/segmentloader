'use strict';
const path = require('path');
const vm = require('vm');
const Conditional = require('@digifi-los/comparison').Conditional;
const conditional = new Conditional({});
const compare = conditional.compare.bind(conditional);
const Promisie = require('promisie');

/**
 * Sets state inside of a "_global" property and contextifies with a compare function in its scope
 * @param {Object} state Application state data containing data from previous functions
 * @return {Object} VM contextified state object
 */
var createContext = function (state, compare) {
  let _global = { state, };
  let context = { _global, compare, };
  vm.createContext(context);
  return context;
};

/**
 * Handles coverting values to string representations consumable by the VM script
 * @param  {*} value Value to convert for the VM
 * @return {string|number}       Converted value
 */
var handleValueAssignment = function (value) {
  if (typeof value === 'string' && value.includes('_global.state')) return value;
  if (typeof value === 'string') return `'${value}'`;
  else if (Array.isArray(value)) {
    return (
      value.reduce((result, v, index) => {
        result +=
          (typeof v === 'string' ? `'${v}'` : v) +
          (index !== value.length - 1 ? ', ' : '');
        return result;
      }, '[') + ']'
    );
  } else if (value && typeof value === 'object') return JSON.stringify(value);
  else return value;
};

/**
 * Handles converting state property comparison value to vm usable value ie. wrapping string values in quotes
 * @param {*} value Any value to be converted to vm usable value
 */
var generateSegmentValue = function (value) {
  if (typeof value === 'string') return `'${ value }'`;
  else if (value && !Array.isArray(value) && typeof value === 'object') return JSON.stringify(value);
  else if (Array.isArray(value)) return value.reduce((result, val, index) => {
    result += `${ generateSegmentValue(val) }`;
    if (index !== value.length - 1) result += ',';
    return result;
  }, '[') + ']';
  return value;
};

/**
 * Creates a script that will be run inside of vm based on segment configuration
 * @param {Object} configuration Configuration object for segement evaluator
 * @param {Object[]} configuration.condition Array of evaluations that should be run against data
 * @param {string} configuration.condition_operations Describes if passing condition should be all-true ("AND") or one true ("OR")
 * @param {string} configuration.condition.state_property_attribute The field which should be evaluated within the state object
 * @param {string} configuration.condition.state_property_attribute_value_comparison Value which data derived from state object should be compared against
 * @param {string} configuration.condition.condition_test Description of the conditional test to be applied
 * @return {string} Returns a string representation of a script to be run in VM
 */
var createScript = function (configuration) {
  let { conditions, } = configuration;
  let condition_groups = [];
  let string_evaluator = conditions.reduce((script, condition) => {
    let { 
      variable_name, 
      value_comparison, 
      value_comparison_type, 
      value_minimum,
      value_minimum_type, 
      value_maximum,
      value_maximum_type,
      condition_test, 
      condition_operation, 
      rule_type, 
      condition_group_id, 
      rule_name, 
    } = condition;
    let condition1 = condition_test.toLowerCase().replace(/\s+/g, '');
    let condition2;
    let eval_group;
    
    value_comparison = (value_comparison && value_comparison_type === 'variable') ? `_global.state['${value_comparison}']` : value_comparison;
    value_minimum = (value_minimum && value_minimum_type === 'variable') ? `_global.state['${value_minimum}']` : value_minimum;
    value_maximum = (value_maximum && value_maximum_type === 'variable') ? `_global.state['${value_maximum}']` : value_maximum;

    script += `if(_global.state[${handleValueAssignment(variable_name)}] === undefined) throw new Error('The Variable ${variable_name} is required by a Rule but is not defined.');\r\n`;
    script += `if(/range/i.test("${condition_test}") && ${handleValueAssignment(value_minimum)} === undefined) throw new Error("The Variable ${condition.value_minimum} is required by a Rule but is not defined.");\r\n`;
    script += `if(/range/i.test("${condition_test}") && ${handleValueAssignment(value_maximum)} === undefined) throw new Error("The Variable ${condition.value_maximum} is required by a Rule but is not defined.");\r\n`;
    script += `if(!(/range/i.test("${condition_test}")) && !(/null/i.test("${condition_test}")) && ${handleValueAssignment(value_comparison)} === undefined) throw new Error("The Variable ${condition.value_comparison} is required by a Rule but is not defined.");\r\n`;
    
    if (/or/i.test(rule_type)) {
      script += `_global.${rule_name} = _global.${rule_name} || [];\r\n`;
      eval_group = `_global.${rule_name}`;
      if (condition_groups.indexOf(rule_name) === -1) condition_groups.push(rule_name);
    } else eval_group = '_global.passes';
    script += `${ eval_group }.push(compare(_global.state${(variable_name.indexOf('[') !== 0) ? '.' + variable_name : variable_name}).${condition1}`;
    if (typeof condition2 === 'string') script += `.${condition2}`;
    script += `(${(/range/i.test(condition_test)) ? (handleValueAssignment(value_minimum) + ', ' + handleValueAssignment(value_maximum)) : handleValueAssignment(value_comparison) }));\r\n`;
    return script;
  }, '"use strict";\r\n_global.passes = [];\r\n');
  
  let or_evaluations = (condition_groups.length) ? condition_groups.reduce((result, _globalKey, index) => {
    if (index < condition_groups.length - 1) result += `_global.${_globalKey}.indexOf(true) !== -1 && `;
    else result += `_global.${_globalKey}.indexOf(true) !== -1`;
    return result;
  }, '(') + ')' : false;
  string_evaluator += (or_evaluations) ? `_global.passes = (_global.passes.indexOf(false) === -1 && ${or_evaluations});\r\n` : '_global.passes = _global.passes.indexOf(false) === -1';
  return string_evaluator;
};

/**
 * Creates an evaluator function
 * @param {Object} configuration Configuration details for script and context of a vm that will determine segment
 * @return {Function} Segment evaluator function
 */
var createEvaluator = function (configuration) {
  let conditional = new Conditional({});
  let compare = conditional.compare.bind(conditional);
  let script = createScript(configuration);
  /**
   * Given state and optionally a default input function determines if state data applies to  a given segment
   * @param {Object} input Used to pass a default input this field will be used as state if state argument is not defined
   * @param {state} state State data must be defined if passing default inputs if this argument is not defined input will be considered state
   * @return {Boolean|Object} returns the segment configuration if passing and a false flag if it does not
   */
  return function evaluator(input, state) {
    try {
      let _state = (state && typeof state === 'object') ? Object.assign({}, state) : Object.assign({}, input);
      let context = createContext(_state, compare);
      let evaluate = new vm.Script(script);
      evaluate.runInContext(context);
      return (context._global.passes) ? configuration : false;
    } catch (e) {
      return { message: e.message, error: e.error || '' };
    }
  };
};

module.exports = createEvaluator;