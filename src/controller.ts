import express, { Handler, NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import 'reflect-metadata';
import {
  ArgumentResolvedHandler,
  AuthenticationMetadata,
  BodyMetadata,
  Constructor,
  ParamMetadata,
  RequestMetadata,
  ClassDecorator,
  MethodDecorator,
  ParameterDecorator,
} from './types';
import { ExpressHelperError } from './error';
import { HttpMethod, RouterMethods } from './http';
import { AbstractParsePipe, ParseEmptyPipe } from './validator';
import * as console from 'console';

declare module 'express-serve-static-core' {
  interface Request {
    user?: unknown;
  }
}

export const controller = express.Router();
const requestMetadataKey = Symbol('request');

const requestArgumentMetadataKey = Symbol('requestArgument');
const responseArgumentMetadataKey = Symbol('responseArgument');
const pathParamArgumentMetadataKey = Symbol('pathParamArgument');
const queryParamArgumentMetadataKey = Symbol('queryParamArgument');
const bodyArgumentMetadataKey = Symbol('bodyArgument');
const authenticationMetadataKey = Symbol('authenticationArgument');
const statusCodeMetadataKey = Symbol('statusCode');
const authMetadataKey = Symbol('auth');

/**
 * `Controller` is a class decorator builder aimed at handling HTTP text/html requests
 * It iterates over methods of a class prototype,
 * retrieves metadata associated with request handling, authentication, and status codes.
 * Then, it modifies each method to either send a file as a response or throw an error.
 *
 * @example
 * \@Controller()
 * class MyController { }
 *
 * @returns {ClassDecorator} - it's return class decorator
 */
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

/**
 * `RestController` is a class decorator builder aimed at handling HTTP application/json requests
 * It iterates over methods of a class prototype,
 * retrieves metadata associated with request handling, authentication, and status codes.
 * Then, it modifies each method to either send a file as a response or throw an error.
 *
 * @example
 * \@RestController()
 * class MyController { }
 *
 * @returns {ClassDecorator} - it's return class decorator
 */
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

/**
 * `argumentsResolvedHandler` is a function that extracts
 * the necessary factors from the handler function of express,
 * injects the instance into the controller function that the user wants,
 * and then returns a proxy handler that invokes the user to the resolved objects.
 *
 * @function
 * @param target - The prototype of the class the method belongs to.
 * @param propertyKey - The name of the method.
 * @param descriptor - The descriptor of the method.
 * @returns {ArgumentResolvedHandler<Request, Response>} - Returns an async function that takes a
 * request and response, resolves and validates the necessary parameters, and invokes the original
 * method with these parameters.
 *
 */
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
  const pathParamArgumentMetadata: ParamMetadata[] = Reflect.getMetadata(
    pathParamArgumentMetadataKey,
    target,
    propertyKey,
  );
  const queryParamArgumentMetadata: ParamMetadata[] = Reflect.getMetadata(
    queryParamArgumentMetadataKey,
    target,
    propertyKey,
  );

  return async (request: Request, response: Response): Promise<unknown> => {
    if (requestMetaData !== undefined) resolvedArguments[requestMetaData] = request;
    if (responseMetaData !== undefined) resolvedArguments[responseMetaData] = response;
    if (bodyMetaData !== undefined)
      resolvedArguments[bodyMetaData.paramIndex] = bodyMetaData.validatePipe.pipe(request.body);
    if (authenticationMetadataKey !== undefined) resolvedArguments[authenticationMetaData] = request.user;
    if (pathParamArgumentMetadata !== undefined) {
      pathParamArgumentMetadata.forEach((pathParamMetadata: ParamMetadata) => {
        const param = request.params[pathParamMetadata.value];
        if (param === undefined) throw new ExpressHelperError(400, 'Bad Request');

        resolvedArguments[pathParamMetadata.paramIndex] = pathParamMetadata.validatePipe.pipe(param);
      });
    }
    if (queryParamArgumentMetadata !== undefined) {
      queryParamArgumentMetadata.forEach((queryParamMetadata: ParamMetadata) => {
        const param = request.query[queryParamMetadata.value];
        if (param === undefined) throw new ExpressHelperError(400, 'Bad Request');
        resolvedArguments[queryParamMetadata.paramIndex] = queryParamMetadata.validatePipe.pipe(param);
      });
    }
    return descriptor.value(...resolvedArguments);
  };
}

/**
 * `RequestMapping` is a MethodDecorator builder that wraps around all HTTP method request handler method
 * within a class. It sets up the URL route, binds all HTTP methods, and associates the
 * `argumentsResolvedHandler` function with the method.
 *
 * @param url - The URL route to be associated with the decorated method.
 * @returns {MethodDecorator} - A MethodDecorator that should be used to decorate an HTTP request handler
 * @deprecated - no longer support methods that support all methods.
 * @see {Get, Post, Put, Delete}
 */
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

/**
 * `Get` is a MethodDecorator function designed for HTTP GET request handler methods
 * within a class. It associates the specified URL route, binds the GET HTTP method, and
 * connects the `argumentsResolvedHandler` function with the method.
 *
 * The decorator will add metadata to the method, specifying the URL route, binding the GET method,
 * defining the name of the method, and associating the `argumentsResolvedHandler` for handling the request.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Get(`/my-route`)
 *   async myMethod() {
 *     // Implementation of the GET request handler
 *   }
 * }
 *
 * @param url - The URL route to be associated with the decorated method.
 * @returns {MethodDecorator} - A MethodDecorator designed for decorating HTTP GET request handler
 * methods within a class.
 */
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

/**
 * `Post` is a MethodDecorator function designed for HTTP POST request handler methods
 * within a class. It associates the specified URL route, binds the POST HTTP method, and
 * connects the `argumentsResolvedHandler` function with the method.
 *
 * The decorator will add metadata to the method, specifying the URL route, binding the POST method,
 * defining the name of the method, and associating the `argumentsResolvedHandler` for handling the request.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Post('/my-route')
 *   async myMethod() {
 *     // Implementation of the POST request handler
 *   }
 * }
 *
 * @param url - The URL route to be associated with the decorated method.
 * @returns {MethodDecorator} - A MethodDecorator designed for decorating HTTP POST request handler
 * methods within a class.
 */
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

/**
 * `Delete` is a MethodDecorator function designed for HTTP DELETE request handler methods
 * within a class. It associates the specified URL route, binds the DELETE HTTP method, and
 * connects the `argumentsResolvedHandler` function with the method.
 *
 * The decorator will add metadata to the method, specifying the URL route, binding the DELETE method,
 * defining the name of the method, and associating the `argumentsResolvedHandler` for handling the request.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Delete('/my-route')
 *   async myMethod() {
 *     // Implementation of the DELETE request handler
 *   }
 * }
 *
 * @param url - The URL route to be associated with the decorated method.
 * @returns {MethodDecorator} - A MethodDecorator designed for decorating HTTP DELETE request handler
 * methods within a class.
 */
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

/**
 * `Put` is a MethodDecorator function designed for HTTP PUT request handler methods
 * within a class. It associates the specified URL route, binds the PUT HTTP method, and
 * connects the `argumentsResolvedHandler` function with the method.
 *
 * The decorator will add metadata to the method, specifying the URL route, binding the PUT method,
 * defining the name of the method, and associating the `argumentsResolvedHandler` for handling the request.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Put('/my-route')
 *   async myMethod(req: Request, res: Response) {
 *     // Implementation of the PUT request handler
 *   }
 * }
 *
 * @param url - The URL route to be associated with the decorated method.
 * @returns {MethodDecorator} - A MethodDecorator designed for decorating HTTP PUT request handler
 * methods within a class.
 */
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

/**
 * `HttpCode` is a MethodDecorator function that allows you to specify an HTTP status code
 * for the response of a request handler method within a class. When the method is invoked,
 * the provided HTTP code will be set as the response status.
 *
 * The decorator stores the specified status code as metadata on the method. This can be used
 * in conjunction with other decorators like `@Get`, `@Post`, `@Put`, etc., to customize the
 * response code for those HTTP methods.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@HttpCode(201)
 *   \@Post('/my-route')
 *   async myMethod() {
 *     // Implementation of the request handler
 *   }
 * }
 *
 * @param code - The HTTP status code to be set when the decorated method is invoked.
 * @returns {MethodDecorator} - A MethodDecorator used to specify the response status code for a
 * request handler method.
 */
export const HttpCode = (code: number): MethodDecorator => {
  return (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor): void => {
    Reflect.defineMetadata(statusCodeMetadataKey, code, descriptor.value);
  };
};

/**
 * `Req` is a ParameterDecorator function designed for use within request handler methods of a class.
 * It marks the parameter as the one that should receive the Express `Request` instance.
 *
 * When the handler method is invoked, the `Request` object from Express will be automatically
 * injected into the decorated parameter, allowing the developer to access all properties and
 * methods of the `Request` object.
 *
 * The decorator stores metadata on the method's parameter indicating it as the designated receiver
 * of the `Request` instance.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Get('/my-route')
 *   async myMethod(@Req() req: Request) {
 *     // Implementation of request handler
 *   }
 * }
 *
 * @returns {ParameterDecorator} - A ParameterDecorator used to specify that the decorated parameter
 * should receive the Express `Request` instance.
 */
export const Req = (): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    Reflect.defineMetadata(requestArgumentMetadataKey, parameterIndex, target, propertyKey);
  };
};

/**
 * `Res` is a ParameterDecorator function designed for use within request handler methods of a class.
 * It marks the parameter as the one that should receive the Express `Response` instance.
 *
 * When the handler method is invoked, the `Response` object from Express will be automatically
 * injected into the decorated parameter, allowing the developer to access all properties and
 * methods of the `Response` object, and consequently send a response to the client.
 *
 * The decorator stores metadata on the method's parameter indicating it as the designated receiver
 * of the `Response` instance.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Get('/my-route')
 *   async myMethod(@Res() res: Response) {
 *     res.send('Hello, World!');
 *     // Implementation of the GET request handler
 *   }
 * }
 *
 * @returns {ParameterDecorator} - A ParameterDecorator used to specify that the decorated parameter
 * should receive the Express `Response` instance.
 *
 */
export const Res = (): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    Reflect.defineMetadata(responseArgumentMetadataKey, parameterIndex, target, propertyKey);
  };
};

/**
 * `Body` is a ParameterDecorator function that marks a parameter within a request handler method
 * to receive the parsed body object from an Express request. Optionally, it allows the developer
 * to specify a validation and transformation pipe to process the body data before it's assigned to
 * the decorated parameter.
 *
 * This decorator stores metadata on the method's parameter indicating it as the designated receiver
 * of the parsed request body and any associated pipe for validation and transformation.
 *
 * The provided pipe is responsible for both validation and transformation of the incoming body data.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Post('/create')
 *   async createItem(@Body(ParseIntPipe) body: number) {
 *     // Implementation of request handler.
 *   }
 * }
 *
 * @param pipe - An optional validation and transformation pipe. By default, `ParseEmptyPipe` is used.
 * @returns {ParameterDecorator} - A ParameterDecorator designed to specify that the decorated
 * parameter should receive the parsed body from an Express request, potentially after processing
 * through the provided pipe.
 */
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

/**
 * `Param` is a ParameterDecorator function that marks a parameter within a request handler method
 * to receive the specified path parameter from an Express route. Optionally, it allows the developer
 * to provide a validation and transformation pipe to process the path parameter before it's passed to
 * the decorated parameter.
 *
 * The decorator aggregates any existing path parameters, then adds the new path parameter
 * and any associated pipe for validation and transformation.
 *
 * The provided pipe is responsible for both validation and transformation of the incoming path parameter.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Get('/:id')
 *   async getItem(@Param('id', ParseIntPipe) id: number) {
 *     // Now, `id` is guaranteed to be a number due to the ParseIntPipe transformation.
 *     // Implementation of request handler.
 *   }
 * }
 *
 * @param value - The name of the path parameter to extract from the route.
 * @param pipe - An optional validation and transformation pipe. By default, `ParseEmptyPipe` is used.
 * @returns {ParameterDecorator} - A ParameterDecorator designed to extract and potentially process
 * a path parameter from an Express route before passing it to the decorated parameter.
 */
export const Param = (value: string, pipe: AbstractParsePipe<unknown> = ParseEmptyPipe): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    const existingPathParam: ParamMetadata[] =
      Reflect.getMetadata(pathParamArgumentMetadataKey, target, propertyKey) || [];
    existingPathParam.push({
      value: value,
      paramIndex: parameterIndex,
      validatePipe: pipe,
    });
    Reflect.defineMetadata(pathParamArgumentMetadataKey, existingPathParam, target, propertyKey);
  };
};

/**
 * `Query` is a ParameterDecorator function that designates a parameter within a request handler method
 * to extract the specified query parameter from an Express request URL. Additionally, developers can
 * optionally specify a validation and transformation pipe to process the query parameter before passing
 * it to the decorated parameter.
 *
 * The decorator aggregates any existing query parameters, then appends the new query parameter
 * and any associated pipe for validation and transformation.
 *
 * The provided pipe is responsible for both the validation and transformation of the received query parameter.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@Get('/items')
 *   async getItems(@Query('limit', ParseIntPipe) limit: number) {
 *     // Now, `limit` is guaranteed to be a number due to the ParseIntPipe transformation.
 *     // Implementation of the GET request handler.
 *   }
 * }
 *
 * @param value - The name of the query parameter to extract from the request URL.
 * @param pipe - An optional validation and transformation pipe. By default, `ParseEmptyPipe` is used.
 * @returns {ParameterDecorator} - A ParameterDecorator constructed to fetch and optionally process
 * a query parameter from an Express request URL before providing it to the decorated parameter.
 */
export const Query = (value: string, pipe: AbstractParsePipe<unknown> = ParseEmptyPipe): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    const existingQueryParam: ParamMetadata[] =
      Reflect.getMetadata(queryParamArgumentMetadataKey, target, propertyKey) || [];
    existingQueryParam.push({
      value: value,
      paramIndex: parameterIndex,
      validatePipe: pipe,
    });
    Reflect.defineMetadata(queryParamArgumentMetadataKey, existingQueryParam, target, propertyKey);
  };
};

/**
 * `AuthenticatedUser` is a ParameterDecorator that facilitates the easy extraction of
 * the authenticated user information stored within `request.user` by the `UseGuard` middleware.
 *
 * When the `AuthenticatedUser` decorator is applied to a parameter in a request handler method,
 * the method is signaled to receive the authenticated user data from the `request.user` property.
 * This allows for concise and clear access to the authenticated user's details.
 *
 * This decorator is especially useful in conjunction with the `UseGuard` decorator, which handles
 * the actual authentication process and stores the authentication result in `request.user`.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@UseGuard(myAuthMiddleware)
 *   \@Get('/user-details')
 *   async userDetails(@AuthenticatedUser() user: User) {
 *     // `user` now contains the authenticated user's information.
 *     // Implementation for returning the authenticated user's details.
 *   }
 * }
 *
 * @returns {ParameterDecorator} - A ParameterDecorator designed to extract the authenticated
 * user's details from `request.user` and provide it to the decorated parameter.
 */
export const AuthenticatedUser = (): ParameterDecorator => {
  return (target: any, propertyKey: string | symbol, parameterIndex: number): void => {
    Reflect.defineMetadata(authenticationMetadataKey, parameterIndex, target, propertyKey);
  };
};

/**
 * `UseGuard` is a MethodDecorator function that allows for the attachment of an authentication middleware
 * to a specific request handler method. The provided authentication middleware performs necessary
 * authentication processes and, if successful, stores the authentication information within `request.user`.
 *
 * Once the middleware completes the authentication checks and updates `request.user`,
 * the request is forwarded to the method it decorates. If the authentication process fails,
 * it's the middleware's responsibility to handle the error appropriately.
 *
 * @example
 * \@RestController
 * class MyController {
 *   \@UseGuard(myAuthMiddleware)
 *   \@Get('/secure-endpoint')
 *   async secureEndpoint(@Req() req: Request) {
 *     // Use `req.user` for authenticated user information.
 *     // Implementation of the GET request handler for authenticated users.
 *   }
 * }
 *
 * @param authMiddleware - The authentication middleware to be invoked before the decorated method.
 * @returns {MethodDecorator} - A MethodDecorator constructed to apply the provided authentication
 * middleware before executing the decorated method.
 */
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
