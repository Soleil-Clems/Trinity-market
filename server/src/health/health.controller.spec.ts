import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

function createController(databaseUp: boolean) {
  const prisma = {
    isHealthy: vi.fn().mockResolvedValue(databaseUp),
  } as unknown as PrismaService;

  return new HealthController(prisma);
}

describe('HealthController', () => {
  it('reports the database as up', async () => {
    await expect(createController(true).check()).resolves.toEqual({
      status: 'ok',
      uptime: expect.any(Number),
      database: 'up',
    });
  });

  it('stays reachable and reports the database as down', async () => {
    await expect(createController(false).check()).resolves.toEqual({
      status: 'degraded',
      uptime: expect.any(Number),
      database: 'down',
    });
  });
});
