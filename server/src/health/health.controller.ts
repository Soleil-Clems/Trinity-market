// Chemin : server/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Endpoint de liveness utilisé par le HEALTHCHECK Docker : GET /api/health
 * Répond toujours 200 tant que le process tourne ; l'état de la base est dans le corps.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const databaseUp = await this.prisma.isHealthy();

    return {
      status: databaseUp ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      database: databaseUp ? 'up' : 'down',
    };
  }
}
