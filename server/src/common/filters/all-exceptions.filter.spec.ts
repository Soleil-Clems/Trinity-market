import {
  ArgumentsHost,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function createHost(request: Record<string, unknown>) {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  const request = { id: 'req-1', originalUrl: '/api/users/42' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T08:00:00.000Z'));
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('formats an HTTP exception', () => {
    const { host, status, json } = createHost(request);

    filter.catch(new NotFoundException('User not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
      requestId: 'req-1',
      path: '/api/users/42',
      timestamp: '2026-10-12T08:00:00.000Z',
    });
  });

  it('keeps the validation details', () => {
    const { host, json } = createHost(request);
    const details = [{ path: 'email', message: 'Invalid email address' }];

    filter.catch(
      new UnprocessableEntityException({
        message: 'Validation failed',
        details,
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Validation failed',
        details,
      }),
    );
  });

  it('hides the cause of an unexpected error and logs it', () => {
    const { host, status, json } = createHost(request);

    filter.catch(new Error('connection to database lost'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      }),
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('connection to database lost'),
    );
  });

  it('returns a null requestId when the request has none', () => {
    const { host, json } = createHost({ url: '/api/health' });

    filter.catch(new NotFoundException(), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: null, path: '/api/health' }),
    );
  });
});
