import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Translates Prisma's known error codes into the REST errors a client
 * actually expects, instead of NestJS's default 500 for anything unhandled.
 * Only P2025 ("record to update/delete not found" → 404) and P2002
 * (unique constraint violation, e.g. Post.slug → 409) are mapped; any other
 * Prisma error code still 500s, which is correct — an unmapped DB error is
 * an operational problem to investigate, not a client-facing 4xx to paper
 * over. See docs/adr/005-admin-auth-and-validation.md.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception.code === 'P2025') {
      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Resource not found',
      });
      return;
    }

    if (exception.code === 'P2002') {
      const target = (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: `A resource with this ${target} already exists`,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
