import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { ExpressHelperError } from './error';
import { controller, seekController } from './controller';
import * as console from "console";

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

export const expressHelper = () => {
  const appFilePath = process.argv[1];
  seekController(path.join(path.dirname(appFilePath), 'controller'));
  return controller;
};
