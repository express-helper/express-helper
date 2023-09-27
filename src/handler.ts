import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { ExpressHelperError } from './error';
import { controller, seekController } from './controller';
import * as console from "console";

/**
 * `expressHelperEndpoint` is an error handling middleware specifically designed for
 * managing errors that arise when using the `expressjs-helper` module. This middleware
 * captures and responds to errors thrown during the processing of routes and controllers
 * defined within the `expressHelper` context.
 *
 * It distinguishes between `ExpressHelperError` instances, which are errors specific to
 * the `expressHelper` module, and generic JavaScript `Error` instances. For
 * `ExpressHelperError`, the error's `statusCode` and `message` are sent as the response.
 * For other generic errors, the middleware logs the error, sends a 500 status code as
 * the response, and rethrows the error to potentially be caught by other error-handling
 * mechanisms in the application.
 *
 * @example
 * app.use(expressHelper());
 * // app.use(other middlewares and routes)
 * app.use(expressHelperEndpoint());  // Place at the end to handle errors from expressHelper
 *
 */
export const expressHelperEndpoint = () => {
  return (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ExpressHelperError) {
      res.status(err.statusCode).json({ message: err.message });
    } else if (err instanceof Error) {
      console.error(err);
      res.status(500).send();
      throw err;
    }
  };
};

/**
 * `expressHelper` is a utility function designed to automatically discover and register
 * controller classes within the specified 'controller' directory relative to the application's
 * entry point. Once discovered, these controllers are processed for their routing definitions
 * and provided as an Express middleware.
 *
 * The purpose of this function is to simplify the process of registering controllers and their
 * routes without manually importing and setting them up one by one. Instead, by calling this
 * function and attaching it as a middleware, all controllers within the 'controller' directory
 * are seamlessly integrated into the Express application.
 *
 * @example
 * app.use(expressHelper());
 *
 */
export const expressHelper = () => {
  const appFilePath = process.argv[1];
  seekController(path.join(path.dirname(appFilePath), 'controller'));
  return controller;
};
