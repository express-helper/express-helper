import {
  Controller,
  controller,
  Cookie,
  Delete,
  Get,
  Head,
  HttpCode,
  Options,
  Param,
  ParseEmptyPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  RestController,
  Trace,
} from '../src';
import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

describe('View Controller Test', () => {
  let app: Express;
  const viewsPath = path.join(__dirname, 'views');

  beforeEach(() => {
    app = express();
    controller.stack.length = 0;
    const files = fs.readdirSync(viewsPath);
    files.forEach((file) => {
      const filePath = path.join(viewsPath, file);
      fs.unlinkSync(filePath);
    });
    app.use(controller);
    app.set('views', viewsPath);
  });

  test('View Test', async () => {
    // given
    const expectedView = `<h1> express-helper</h1>`;
    const viewPath = path.join(viewsPath, 'index.html');
    fs.writeFileSync(viewPath, expectedView);
    @Controller()
    class TestController {
      @Get('/')
      index() {
        return 'index.html';
      }
    }

    // when
    const getResponse = await request(app).get('/');

    // then
    expect(getResponse.statusCode).toEqual(200);
    expect(getResponse.text).toBe(`<h1> express-helper</h1>`);
  });
});
describe('Http Method Test', () => {
  let app: Express;
  beforeEach(() => {
    app = express();
    controller.stack.length = 0;
    app.use(controller);
  });

  test('The @Get decorator is routed to the Http get method.', async () => {
    // given
    @RestController()
    class TestController {
      @Get('/get')
      getMethod() {
        return 'get';
      }
    }
    // when
    const getResponse = await request(app).get('/get');

    // then
    expect(getResponse.statusCode).toEqual(200);
    expect(JSON.parse(getResponse.text)).toBe('get');
  });

  test('The @Post decorator is routed to the Http post method.', async () => {
    // given
    @RestController()
    class TestController {
      @Post('/post')
      postMethod() {
        return 'post';
      }
    }

    // when
    const response = await request(app).post('/post');

    // then
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.text)).toBe('post');
  });

  test('The @Delete decorator is routed to the Http delete method.', async () => {
    // given
    @RestController()
    class TestController {
      @Delete('/delete')
      deleteMethod() {
        return 'delete';
      }
    }

    // when
    const response = await request(app).delete('/delete');

    // then
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.text)).toBe('delete');
  });

  test('The @Put decorator is routed to the Http put method.', async () => {
    // given
    @RestController()
    class TestController {
      @Put('/put')
      putMethod() {
        return 'put';
      }
    }

    // when
    const response = await request(app).put('/put');

    // then
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.text)).toBe('put');
  });

  test('The @Patch decorator is routed to the Http patch method.', async () => {
    // given
    @RestController()
    class TestController {
      @Patch('/patch')
      patchMethod() {
        return 'patch';
      }
    }

    // when
    const response = await request(app).patch('/patch');

    // then
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.text)).toBe('patch');
  });

  test('The @Head decorator is routed to the Http head method.', async () => {
    // given
    @RestController()
    class TestController {
      @Head('/head')
      headMethod() {}
    }

    // when
    const response = await request(app).head('/head');

    // then
    expect(response.statusCode).toEqual(204);
    expect(response.headers['content-length']).toBe(undefined);
  });

  test('The @Options decorator is routed to the Http options method.', async () => {
    // given
    @RestController()
    class TestController {
      @Options('/options')
      optionsMethod(@Res() res: Response) {
        res.header('Allow', 'GET, POST, PUT, DELETE');
      }
    }

    // when
    const response = await request(app).options('/options');

    // then
    expect(response.statusCode).toEqual(204);
    expect(response.header['allow']).toEqual('GET, POST, PUT, DELETE'); // 헤더에 허용된 메서드 목록이 있는지 확인합니다.
  });

  test('The @Trace decorator is routed to the Http trace method.', async () => {
    // given
    @RestController()
    class TestController {
      @Trace('/trace')
      traceMethod(@Req() req: Request) {
        return 'trace';
      }
    }

    // when
    const response = await request(app).trace('/trace');

    // then
    expect(response.statusCode).toEqual(200);
    expect(JSON.parse(response.text)).toBe('trace');
  });

  test.skip('The @HttpCode decorator set http code of the response', async () => {
    // given
    @RestController()
    class TestController {
      @Get('/http-code')
      @HttpCode(204)
      getMethod() {
        return 'get';
      }
    }

    // when
    const response = await request(app).get('/http-code');

    // then
    expect(response.statusCode).toEqual(204);
    expect(response.text).toBe('get');
  });
});

describe('Http Message Argument resolver Test', () => {
  let app: Express;
  beforeEach(() => {
    app = express();
    controller.stack.length = 0;
    app.use(controller);
  });

  test('@Req injects a Request object into the bound parameter.', async () => {
    // given
    @RestController()
    class TestController {
      @Get('/req')
      checkRequest(@Req() req: Request): boolean {
        return req !== undefined;
      }
    }

    // when
    const response = await request(app).get('/req');

    // then
    expect(response.status).toEqual(200);
    expect(JSON.parse(response.text)).toEqual(true);
  });

  test('@Res injects a Response object into the bound parameter.', async () => {
    // given
    @RestController()
    class TestController {
      @Get('/res')
      checkResponse(@Res() res: Response): boolean {
        return res !== undefined;
      }
    }

    // when
    const response = await request(app).get('/res');

    // then
    expect(response.status).toEqual(200);
    expect(JSON.parse(response.text)).toEqual(true);
  });

  test('@Param binds the path variables', async () => {
    // given
    @RestController()
    class TestController {
      @Get('/test/:name/param/:id')
      param(@Param('name', ParseEmptyPipe) name: string, @Param('id', ParseIntPipe) id: number) {
        return { name, id };
      }
    }

    // when
    const response = await request(app).get('/test/param-bind/param/4');

    // then
    expect(response.status).toEqual(200);
    expect(response.body).toEqual({ name: 'param-bind', id: 4 });
  });

  test('@Query binds the query param variables', async () => {
    // given
    @RestController()
    class TestController {
      @Get('/query')
      query(@Query('name', ParseEmptyPipe) name: string, @Query('id', ParseIntPipe) id: number) {
        return { name, id };
      }
    }

    // when
    const response = await request(app).get('/query?name=query-bind&id=3');

    // then
    expect(response.status).toEqual(200);
    expect(response.body).toEqual({ name: 'query-bind', id: 3 });
  });

  test('@Cookie binds the cookie variables', async () => {
    // given
    @RestController()
    class TestController {
      @Get('/cookie')
      cookie(@Cookie('sessionId') sessionId: string, @Cookie('key') key: string) {
        return { sessionId, key };
      }
    }

    // when
    const cookies = ['sessionId=sessionId', 'key=key'];
    const response = await request(app).get('/cookie').set('Cookie', cookies.join('; '));

    // then
    expect(response.status).toEqual(200);
    expect(response.body).toEqual({ sessionId: 'sessionId', key: 'key' });
  });
});
