import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { testDatabase } from './test-database.js';

export default async function setup(): Promise<void> {
  const { name, url, adminUrl } = testDatabase();
  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: adminUrl }),
  });

  try {
    const existing = await admin.$queryRaw<unknown[]>`
      SELECT 1 FROM pg_database WHERE datname = ${name}
    `;

    if (existing.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
