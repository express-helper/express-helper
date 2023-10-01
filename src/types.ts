import { NextFunction, Request, Response } from 'express';
import { HttpMethod } from './http';
import { AbstractParsePipe } from './validator';

export type Constructor<T = any> = new (...args: any[]) => T;
export type Controller = (...args: unknown[]) => unknown;
export type Handler = (req: Request, res: Response, nest: NextFunction) => any;

export type ClassDecorator = (constructor: Constructor) => void;

export type MethodDecorator = (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => void;

export type ParameterDecorator = (target: any, propertyKey: string | symbol, parameterIndex: number) => void;

export type ArgumentResolvedHandler<T extends Request, U extends Response> = (
  request: T,
  response: U,
) => Promise<unknown>;

export interface RequestMetadata {
  url: string;
  methods: HttpMethod[];
  controller: Controller;
}

export interface HandlerArgumentMetadata {
  paramIndex: number;
  validatePipe: AbstractParsePipe<unknown>;
}

export interface ParamMetadata extends HandlerArgumentMetadata {
  value: string;
}

export interface BodyMetadata extends HandlerArgumentMetadata {}

export interface AuthenticationMetadata extends HandlerArgumentMetadata {
  authMiddleware: Handler;
}

export interface CookieMetadata extends HandlerArgumentMetadata {
  value: string;
}
