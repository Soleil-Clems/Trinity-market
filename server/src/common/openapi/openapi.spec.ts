import { Body, Controller, Get, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { createZodDto } from '../validation/zod-dto.js';
import { buildOpenApiDocument } from './openapi.js';

class CreateTeamDto extends createZodDto(
  z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    size: z.number().int().min(1),
  }),
) {}

@Controller('teams')
class TeamsController {
  @Get()
  list() {
    return [];
  }

  @Post()
  create(@Body() body: CreateTeamDto) {
    return body;
  }
}

describe('buildOpenApiDocument', () => {
  it('describes the routes and the zod DTOs', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TeamsController],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const document = buildOpenApiDocument(app);
    await app.close();

    expect(document.info.title).toBe('Time Manager API');
    expect(Object.keys(document.paths)).toEqual(['/api/teams']);
    expect(document.paths['/api/teams'].post?.requestBody).toEqual({
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateTeamDto' },
        },
      },
    });
    expect(document.components?.schemas?.CreateTeamDto).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        description: { type: 'string' },
        size: expect.objectContaining({ type: 'integer', minimum: 1 }),
      },
      required: ['name', 'size'],
    });
  });
});
