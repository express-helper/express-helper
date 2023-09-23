export class ExpressHelperError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string = '') {
    super(message);
    this.statusCode = statusCode;
  }
}

export class ValidatePipeError extends ExpressHelperError {
  constructor(statusCode: number, message: string = '') {
    super(statusCode, message);
  }
}
