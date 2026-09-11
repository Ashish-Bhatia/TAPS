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

  it('maps P2003 (foreign key constraint violation) to 409', () => {
    const { host, response } = makeHost();

    filter.catch(makeError('P2003', { field_name: 'Syllabus_examBoardId_fkey (index)' }), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 409,
      message: 'Cannot delete or update this resource: other records still reference it',
    });
  });

  it('maps P2003 to 409 even when meta.field_name is missing', () => {
    // Real-world Prisma behavior: field_name isn't always populated depending
    // on the connector (prisma/prisma#24293) — the filter must not depend on
    // it being present.
    const { host, response } = makeHost();

    filter.catch(makeError('P2003'), host);

    expect(response.status).toHaveBeenCalledWith(409);
  });

  it('falls back to 500 for an unmapped Prisma error code', () => {
    const { host, response } = makeHost();

    filter.catch(makeError('P2001'), host);

    expect(response.status).toHaveBeenCalledWith(500);
  });
});
