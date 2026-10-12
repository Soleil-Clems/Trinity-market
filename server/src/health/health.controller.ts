// Chemin : server/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

/**
 * Endpoint de liveness utilisé par le HEALTHCHECK Docker : GET /api/health
 * Pour un vrai readiness check (ping DB), remplacer par @nestjs/terminus.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}