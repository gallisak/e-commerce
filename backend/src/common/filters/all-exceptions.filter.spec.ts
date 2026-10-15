import { type ArgumentsHost, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

const hostFor = (headersSent = false) => {
  const response = {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    destroy: vi.fn(),
  };
  const request = { method: 'GET', originalUrl: '/api/things?page=2' };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
};

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps the HttpException payload and adds request metadata', () => {
    const { host, response } = hostFor();
    filter.catch(new ConflictException({ message: 'Only 1 left', available: 1 }), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
        message: 'Only 1 left',
        available: 1,
        path: '/api/things?page=2',
        timestamp: expect.any(String),
      }),
    );
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('preserves validation message arrays', () => {
    const { host, response } = hostFor();
    filter.catch(new BadRequestException(['name must be a string']), host);
    expect(response.json.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: ['name must be a string'],
    });
  });

  it('maps database outages to 503 and logs them', () => {
    const { host, response } = hostFor();
    filter.catch(
      new Prisma.PrismaClientKnownRequestError('connect failed', {
        code: 'ECONNREFUSED',
        clientVersion: 'test',
      }),
      host,
    );
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json.mock.calls[0][0]).toMatchObject({
      message: 'Service temporarily unavailable',
    });
    expect(errorLog.mock.calls[0][0]).toContain('[ECONNREFUSED]');
  });

  it('hides details of unexpected errors from the client', () => {
    const { host, response } = hostFor();
    filter.catch(new TypeError('Cannot read properties of undefined (secret internals)'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret internals');
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('secret internals'),
      expect.stringContaining('TypeError'),
    );
  });

  it('passes through client errors raised by body parsing', () => {
    const { host, response } = hostFor();
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
    });
    filter.catch(tooLarge, host);
    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json.mock.calls[0][0]).toMatchObject({ error: 'Payload Too Large' });
  });

  it('aborts the connection when headers were already sent (e.g. CSV stream)', () => {
    const { host, response } = hostFor(true);
    filter.catch(new Error('stream broke'), host);
    expect(response.destroy).toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
