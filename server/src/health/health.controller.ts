// Chemin : server/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Endpoint de liveness utilisé par le HEALTHCHECK Docker : GET /api/health
 * Répond toujours 200 tant que le process tourne ; l'état de la base est dans le corps.
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "État de l'API et de la base de données" })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok', 'degraded'] },
        uptime: {
          type: 'integer',
          description: 'Secondes depuis le démarrage',
        },
        database: { type: 'string', enum: ['up', 'down'] },
      },
      required: ['status', 'uptime', 'database'],
    },
  })
  async check() {
    const databaseUp = await this.prisma.isHealthy();

    return {
      status: databaseUp ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      database: databaseUp ? 'up' : 'down',
    };
  }
}
