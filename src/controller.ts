import express, { Handler, NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import 'reflect-metadata';
import {
  ArgumentResolvedHandler,
  AuthenticationMetadata,
  BodyMetadata,
  Constructor,
  QueryMetadata,
  RequestMetadata,
  ClassDecorator,
  MethodDecorator,
  ParameterDecorator,
} from './types';
import { ExpressHelperError } from './error';
import { HttpMethod, RouterMethods } from './http';
import { AbstractParsePipe, ParseEmptyPipe } from './validator';

declare module 'express-serve-static-core' {
  interface Request {
    user?: unknown;
  }
}

export const controller = express.Router();
const requestMetadataKey = Symbol('request');

const requestArgumentMetadataKey = Symbol('requestArgument');
const responseArgumentMetadataKey = Symbol('responseArgument');
const queryArgumentMetadataKey = Symbol('queryArgument');
const bodyArgumentMetadataKey = Symbol('bodyArgument');
const authenticationMetadataKey = Symbol('authenticationArgument');
const statusCodeMetadataKey = Symbol('statusCode');
const authMetadataKey = Symbol('auth');

export function Controller(): ClassDecorator {
  return (constructor: Constructor): void => {
    const { prototype } = constructor;

    Object.getOwnPropertyNames(prototype).forEach((method) => {
      const handlerMetaData: RequestMetadata = Reflect.getMetadata(requestMetadataKey, prototype[method]);
      if (method === 'constructor' || handlerMetaData === undefined) return;
      const auth: AuthenticationMetadata = Reflect.getMetadata(authMetadataKey, prototype[method]);
      const statusCode: number = Reflect.getMetadata(statusCodeMetadataKey, prototype[method]) || 200;

      handlerMetaData.methods.forEach((m: string) => {
        prototype[method] = async (request: Request, response: Response, next: NextFunction) => {
          try {
            const returnView = await handlerMetaData.controller.call(prototype, request, response, next);
            if (typeof returnView === 'string') {
              response.status(statusCode).sendFile(path.join(request.app.get('views'), returnView));
            } else next(new ExpressHelperError(400, 'Invalid View Path Type'));
          } catch (e) {
            next(e);
          }
        };

        if (!auth) controller[m.toLowerCase() as RouterMethods](handlerMetaData.url, prototype[method]);
        else controller[m.toLowerCase() as RouterMethods](handlerMetaData.url, auth.authMiddleware, prototype[method]);
      });
    });
  };
}

export const RestController = (): ClassDecorator => {
  return (constructor: Constructor): void => {
    const { prototype } = constructor;

    Object.getOwnPropertyNames(prototype).forEach((method) => {
      const metadata: RequestMetadata = Reflect.getMetadata(requestMetadataKey, prototype[method]);
      if (method === 'constructor' || metadata === undefined) return;
      const auth: AuthenticationMetadata = Reflect.getMetadata(authMetadataKey, prototype[method]);
      const statusCode: number = Reflect.getMetadata(statusCodeMetadataKey, prototype[method]) || 200;

      metadata.methods.forEach((m) => {
        const handler = async (request: Request, response: Response, next: NextFunction): Promise<void> => {
          try {
            const returnValue = await metadata.controller.call(prototype, request, response, next);
            if (returnValue) response.status(statusCode).json(returnValue);
            else response.status(204).send();
          } catch (e) {
            next(e);
          }
        };

        if (!auth) controller[m.toLowerCase() as RouterMethods](metadata.url, handler);
        else controller[m.toLowerCase() as RouterMethods](metadata.url, auth.authMiddleware, handler);
      });
    });
  };
};

function argumentsResolvedHandler(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): ArgumentResolvedHandler<Request, Response> {
  const resolvedArguments = new Array(descriptor.value.length);
  const requestMetaData = Reflect.getMetadata(requestArgumentMetadataKey, target, propertyKey);
  const responseMetaData = Reflect.getMetadata(responseArgumentMetadataKey, target, propertyKey);
  const bodyMetaData: BodyMetadata = Reflect.getMetadata(bodyArgumentMetadataKey, target, propertyKey);
  const authenticationMetaData = Reflect.getMetadata(authenticationMetadataKey, target, propertyKey);
  const queryParamMetaDatas: QueryMetadata[] = Reflect.getMetadata(queryArgumentMetadataKey, target, propertyKey);

  return async (request: Request, response: Response): Promise<unknown> => {
    if (requestMetaData !== undefined) resolvedArguments[requestMetaData] = request;
    if (responseMetaData !== undefined) resolvedArguments[responseMetaData] = response;
    if (bodyMetaData !== undefined)
      resolvedArguments[bodyMetaData.paramIndex] = bodyMetaData.validatePipe.pipe(request.body);
    if (authenticationMetadataKey !== undefined) resolvedArguments[authenticationMetaData] = request.user;
    if (queryParamMetaDatas !== undefined) {
      queryParamMetaDatas.forEach((queryParamMetadata: QueryMetadata) => {
        const param = request.params[queryParamMetadata.value];
        if (param === undefined) throw new ExpressHelperError(400, 'Bad Request');

        resolvedArguments[queryParamMetadata.paramIndex] = queryParamMetadata.validatePipe.pipe(param);
      });
    }
    return descriptor.value(...resolvedArguments);
  };
}

export function RequestMapping(url: string): MethodDecorator {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const handler = argumentsResolvedHandler(target, propertyKey, descriptor);

    Reflect.defineMetadata(
      requestMetadataKey,
      {
        url,
        methods: [...HttpMethod.values()],
        name: propertyKey,
        controller: handler,
      },
      descriptor.value,
    );
  };
}

export function Get(url: string): MethodDecorator {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const handler = argumentsResolvedHandler(target, propertyKey, descriptor);

    Reflect.defineMetadata(
      requestMetadataKey,
      {
        url,
        methods: [HttpMethod.GET],
        name: propertyKey,
        controller: handler,
      },
      descriptor.value,
    );
  };
}

export function Post(url: string): MethodDecorator {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const handler = argumentsResolvedHandler(target, propertyKey, descriptor);

    Reflect.defineMetadata(
      requestMetadataKey,
      {
        url,
        methods: [HttpMethod.POST],
        name: propertyKey,
        controller: handler,
      },
      descriptor.value,
    );
  };
}

export function Delete(url: string): MethodDecorator {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor): void => {
    const handler = argumentsResolvedHandler(target, propertyKey, descriptor);

    Reflect.defineMetadata(
      requestMetadataKey,
      {
        url,
        methods: [HttpMethod.DELETE],
        name: propertyKey,
        controller: handler,
      },
      descriptor.value,
    );
  };
}

export function Put(url: string): MethodDecorator {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor): void => {
    const handler = argumentsResolvedHandler(target, propertyKey, descriptor);

    Reflect.defineMetadata(
      requestMetadataKey,
      {
        url,
        methods: [HttpMethod.PUT],
        name: propertyKey,
        controller: handler,
      },
      descriptor.value,
    );
  };
}

export const HttpCode = (code: number): MethodDecorator => {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor): void => {
    Reflect.defineMetadata(statusCodeMetadataKey, code, descriptor.value);
  };
};

export const Req = (): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    Reflect.defineMetadata(requestArgumentMetadataKey, parameterIndex, target, propertyKey);
  };
};

export const Res = (): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    Reflect.defineMetadata(responseArgumentMetadataKey, parameterIndex, target, propertyKey);
  };
};

export const Body = (pipe: AbstractParsePipe<unknown> = ParseEmptyPipe): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    Reflect.defineMetadata(
      bodyArgumentMetadataKey,
      { paramIndex: parameterIndex, validatePipe: pipe },
      target,
      propertyKey,
    );
  };
};

export const Param = (value: string, pipe: AbstractParsePipe<unknown> = ParseEmptyPipe): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    const existingQueryParam: QueryMetadata[] =
      Reflect.getMetadata(queryArgumentMetadataKey, target, propertyKey) || [];
    existingQueryParam.push({
      value: value,
      paramIndex: parameterIndex,
      validatePipe: pipe,
    });
    Reflect.defineMetadata(queryArgumentMetadataKey, existingQueryParam, target, propertyKey);
  };
};

export const AuthenticatedUser = (): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    Reflect.defineMetadata(authenticationMetadataKey, parameterIndex, target, propertyKey);
  };
};

export function UseGuard(authMiddleware: Handler): MethodDecorator {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(authMetadataKey, { authMiddleware: authMiddleware }, descriptor.value);
  };
}

export const seekController = async (dir: string) => {
  const dirFile = fs.readdirSync(dir);
  for (const f of dirFile) {
    const filePath = path.join(dir, f);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) await seekController(filePath);
    else import(filePath);
  }
};
