import { controller, Cookie, Get, RestController } from '../src';
import request from 'supertest';
import express, { Express } from 'express';

describe('Http Message Argument resolver Test', () => {
  let app: Express;
  beforeEach(() => {
    app = express();
    controller.stack.length = 0;
    app.use(controller);
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
