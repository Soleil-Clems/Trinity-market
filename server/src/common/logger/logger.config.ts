import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../../config/env.js';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;
const LOG_LEVELS: Record<Env['NODE_ENV'], string> = {
  development: 'debug',
  test: 'silent',
  production: 'info',
};

export function resolveRequestId(
  request: IncomingMessage,
  response: ServerResponse,
): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : randomUUID();

  response.setHeader(REQUEST_ID_HEADER, requestId);

  return requestId;
}

export function buildLoggerParams(nodeEnv: Env['NODE_ENV']): Params {
  return {
    pinoHttp: {
      level: LOG_LEVELS[nodeEnv],
      genReqId: resolveRequestId,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      autoLogging: {
        ignore: (request) => request.url === '/api/health',
      },
    },
  };
}
