import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { ExpressHelperError } from './error';
import { controller, seekController } from './controller';

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
  seekController(path.join('src', 'controller'));
  return controller;
};
