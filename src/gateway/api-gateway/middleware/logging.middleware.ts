//  HTTP request/response logging middleware

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const correlationId = req['correlationId'];
    const userAgent = req.get('user-agent') || '';

    // Log request
    this.logger.log(`${method} ${originalUrl} - ${ip} - ${userAgent} - ${correlationId}`);

    // Log response
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} - ${responseTime}ms - ${correlationId}`,
      );
    });

    next();
  }
}

// ============================================
