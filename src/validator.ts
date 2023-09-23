import { ValidatePipeError } from './error';

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

class ParseDefaultPipe extends AbstractParsePipe<string> {
  validate(value: string): boolean {
    return true;
  }

  parse(value: string): string {
    return value;
  }
}

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
