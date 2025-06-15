//  Response compression middleware

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as compression from 'compression';

@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private compressionMiddleware = compression({
    filter: (req, res) => {
      // Don't compress for webhooks or if x-no-compression header is present
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Compress for all other requests
      return compression.filter(req, res);
    },
    level: 6, // Balanced compression level
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.compressionMiddleware(req, res, next);
  }
}

// ============================================
