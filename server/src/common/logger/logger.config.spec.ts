import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildLoggerParams, resolveRequestId } from './logger.config.js';

function createExchange(headers: Record<string, string> = {}) {
  const setHeader = vi.fn();

  return {
    request: { headers } as unknown as IncomingMessage,
    response: { setHeader } as unknown as ServerResponse,
    setHeader,
  };
}

describe('resolveRequestId', () => {
  it('generates an identifier and exposes it in the response', () => {
    const { request, response, setHeader } = createExchange();

    const requestId = resolveRequestId(request, response);

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', requestId);
  });

  it('reuses a well-formed identifier sent by the caller', () => {
    const { request, response } = createExchange({
      'x-request-id': 'trace-12345678',
    });

    expect(resolveRequestId(request, response)).toBe('trace-12345678');
  });

  it('ignores a malformed identifier sent by the caller', () => {
    const { request, response } = createExchange({
      'x-request-id': 'bad id\nwith newline',
    });

    expect(resolveRequestId(request, response)).not.toBe(
      'bad id\nwith newline',
    );
  });
});

describe('buildLoggerParams', () => {
  it.each([
    ['development', 'debug'],
    ['test', 'silent'],
    ['production', 'info'],
  ] as const)('uses the %s log level', (nodeEnv, level) => {
    expect(buildLoggerParams(nodeEnv).pinoHttp).toMatchObject({ level });
  });
});
