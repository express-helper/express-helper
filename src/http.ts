import { ExpressHelperError } from './error';

export enum HttpMethod {
  GET = 'GET',
  PUT = 'PUT',
  PATCH = 'PATCH',
  POST = 'POST',
  DELETE = 'DELETE',
}

export type RouterMethods = 'get' | 'post' | 'put' | 'delete' | 'patch';

export namespace HttpMethod {
  export function values(): HttpMethod[] {
    return [HttpMethod.GET, HttpMethod.POST, HttpMethod.PATCH, HttpMethod.DELETE, HttpMethod.PUT];
  }

  export function of(method: string): HttpMethod {
    switch (method.replace(/\t/g, '').toUpperCase()) {
      case 'GET':
        return HttpMethod.GET;
      case 'PUT':
        return HttpMethod.PUT;
      case 'PATCH':
        return HttpMethod.PATCH;
      case 'POST':
        return HttpMethod.POST;
      case 'DELETE':
        return HttpMethod.DELETE;
      default:
        throw new ExpressHelperError(405, 'Unsupported Http Method');
    }
  }
}
