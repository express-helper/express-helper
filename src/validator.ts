import { ValidatePipeError } from './error';

/**
 * `AbstractParsePipe` is an abstract class serving as a blueprint for validation and
 * transformation pipes that can be used within the `expressjs-helper` context. This class
 * follows the Template Method Pattern, providing a fixed algorithm (the `pipe` method)
 * with some steps (like `validate` and `parse`) delegated to subclasses. Derived classes
 * should implement the `validate` and `parse` methods according to their specific requirements.
 *
 * The idea is to streamline the validation and transformation process by ensuring that
 * validation is always performed before transformation, and that if validation fails,
 * a `ValidatePipeError` is thrown with an appropriate HTTP status code and message.
 *
 * @typeparam T - The type to which the input value `U` will be transformed.
 * @typeparam U - The type of the input value to be validated and transformed.
 *
 * @property DEFAULT_FAIL_STATUS_CODE - The default HTTP status code for validation failures.
 * @property DEFAULT_RESPONSE_MESSAGE - The default response message for validation failures.
 * @property statusCode - The HTTP status code to be associated with this pipe's validation error.
 * @property message - The error message to be associated with this pipe's validation error.
 *
 * @method validate - An abstract method to be implemented by subclasses, determining if a value is valid.
 * @method parse - An abstract method to be implemented by subclasses, defining how to transform a valid value.
 * @method pipe - The template method that first validates and then transforms a given value.
 */
export abstract class AbstractParsePipe<T, U = unknown> {
  static DEFAULT_FAIL_STATUS_CODE = 400;
  static DEFAULT_RESPONSE_MESSAGE = 'Bad Request';
  abstract validate(value: U): boolean;
  abstract parse(value: U): T;
  statusCode: number;
  message: string;

  constructor(
    statusCode: number = AbstractParsePipe.DEFAULT_FAIL_STATUS_CODE,
    message: string = AbstractParsePipe.DEFAULT_RESPONSE_MESSAGE,
  ) {
    this.statusCode = statusCode;
    this.message = message;
  }

  pipe(value: U): T {
    if (!this.validate(value)) throw new ValidatePipeError(this.statusCode, this.message);
    return this.parse(value);
  }
}

/**
 * `ParseDefaultPipe` is a concrete implementation of the `AbstractParsePipe` that performs
 * no additional validation or transformation on the input value. It's essentially a "pass-through"
 * pipe, designed to be a default option when no specific validation or transformation behavior is required.
 *
 * The `validate` method always returns true, indicating that every input is considered valid,
 * and the `parse` method simply returns the original input value without any modifications.
 *
 * @extends {AbstractParsePipe<string>}
 */
class ParseDefaultPipe extends AbstractParsePipe<string> {
  validate(value: string): boolean {
    return true;
  }

  parse(value: string): string {
    return value;
  }
}

/**
 * `IntPipe` is a concrete implementation of the `AbstractParsePipe` specifically designed
 * to validate and transform string values into integers. This class is a default pipe provided
 * for number types and can be easily integrated into the `expressHelper` context.
 *
 * The `validate` method checks if the given string value can be converted to a valid number,
 * while the `parse` method transforms the valid string value into its integer representation.
 *
 * @extends {AbstractParsePipe<number>}
 */
class IntPipe extends AbstractParsePipe<number> {
  validate(value: string): boolean {
    return !isNaN(Number(value));
  }

  parse(value: string): number {
    return parseInt(value);
  }
}

export const ParseIntPipe = new IntPipe();
export const ParseEmptyPipe = new ParseDefaultPipe();
