import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';

function makeHost(): {
  host: ArgumentsHost;
  response: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
} {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

// Prisma's real error constructor requires internal fields; a plain object
// cast is enough here since the filter only reads `.code` and `.meta`.
function makeError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return {
    code,
    meta,
    name: 'PrismaClientKnownRequestError',
    message: code,
  } as Prisma.PrismaClientKnownRequestError;
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it('maps P2025 (record not found) to 404', () => {
    const { host, response } = makeHost();

    filter.catch(makeError('P2025'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ statusCode: 404, message: 'Resource not found' });
  });

  it('maps P2002 (unique constraint) to 409 naming the conflicting field', () => {
    const { host, response } = makeHost();

    filter.catch(makeError('P2002', { target: ['slug'] }), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'A resource with this slug already exists',
    });
  });

  it('falls back to 500 for an unmapped Prisma error code', () => {
    const { host, response } = makeHost();

    filter.catch(makeError('P2003'), host);

    expect(response.status).toHaveBeenCalledWith(500);
  });
});
