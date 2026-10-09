// Chemin : server/src/main.ts
import { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  // Mode debug désactivé en prod : pas de niveaux debug/verbose
  const logger: LogLevel[] = isProd
    ? ['fatal', 'error', 'warn', 'log']
    : ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });

  app.set('trust proxy', 1);       // IP client réelle derrière Traefik (rate-limit, logs)
  app.disable('x-powered-by');
  app.setGlobalPrefix('api');

  // CORS restreint au domaine (CORS_ORIGIN=https://app.example.com[,https://autre])
  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Swagger / outils de debug : uniquement hors prod
  // if (!isProd) { SwaggerModule.setup('api/docs', app, document); }

  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
bootstrap();
