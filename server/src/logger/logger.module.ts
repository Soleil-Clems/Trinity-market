// Chemin : server/src/logger/logger.module.ts
// Logs applicatifs en JSON structuré (pino), sans données personnelles (RGPD).
// Dépendances : npm install nestjs-pino@5 pino-http@11 pino@10
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { stdTimeFunctions } from 'pino';

// Champs retirés de TOUT log (requêtes, objets métier, erreurs).
const REDACTED_PATHS = [
  'password', 'email', 'token', 'accessToken', 'refreshToken',
  'firstName', 'lastName', 'phone', 'address', 'birthDate',
  '*.password', '*.email', '*.token', '*.accessToken', '*.refreshToken',
  '*.firstName', '*.lastName', '*.phone', '*.address', '*.birthDate',
  'req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
];

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        base: { service: 'backend', env: process.env.NODE_ENV },
        timestamp: stdTimeFunctions.isoTime,
        redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
        // Identifiant de corrélation (repris de Traefik s'il existe), renvoyé au client
        genReqId: (req, res) => {
          const id = (req.headers['x-request-id'] as string) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        // Minimum utile : ni en-têtes, ni IP (donnée personnelle), ni query string
        serializers: {
          req: (req) => ({ id: req.id, method: req.method, path: String(req.url ?? '').split('?')[0] }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
        // Niveau selon le résultat : 5xx = error, 4xx = warn, le reste = info
        customLogLevel: (_req, res, err) =>
          err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        // Les healthchecks (toutes les 15 s) noieraient les vrais événements
        autoLogging: { ignore: (req) => req.url === '/api/health' },
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}