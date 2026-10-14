import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api returns the greeting', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('GET /api/health returns 200', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('returns the error format on an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/unknown')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/unknown',
      requestId: response.headers['x-request-id'],
      path: '/api/unknown',
      timestamp: expect.any(String),
    });
  });

  it('reuses the request identifier sent by the caller', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/unknown')
      .set('x-request-id', 'trace-12345678')
      .expect(404);

    expect(response.body.requestId).toBe('trace-12345678');
  });
});
