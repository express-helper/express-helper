import { describe } from 'node:test';
import { ExpressHelperError, ValidatePipeError } from '../src';

describe('error Test', () => {
  test('ExpressHelperError is compatible with ValidatePipeError.', () => {
    const validatePipeError = new ValidatePipeError(400, 'Bad Request');
    expect(() => {
      throw validatePipeError;
    }).toThrow(ExpressHelperError);
  });
});
