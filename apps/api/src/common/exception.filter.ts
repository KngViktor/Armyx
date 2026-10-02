import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Uniform JSON errors. Unexpected errors are logged with the request id and
 * returned as a generic 500 — stack traces and SQL never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request & { id?: string }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : { statusCode: status, ...(body as object) });
      return;
    }

    // Unique violations surface as 409 (e.g. double submission race).
    if ((exception as { code?: string })?.code === '23505') {
      res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'This record already exists' });
      return;
    }

    this.log.error({ err: exception, reqId: req.id }, 'Unhandled error');
    res.status(500).json({ statusCode: 500, message: 'Something went wrong. Please try again.', requestId: req.id });
  }
}
