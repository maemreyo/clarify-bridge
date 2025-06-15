//  Winston logger configuration

import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Custom format for production logs
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Custom format for development logs
const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  nestWinstonModuleUtilities.format.nestLike('ClarityBridge', {
    prettyPrint: true,
    colors: true,
  }),
);

// Create Winston logger instance
export const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isDevelopment ? developmentFormat : productionFormat,
  defaultMeta: { service: 'clarity-bridge' },
  transports: [
    // Console transport
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

// Add file transports in production
if (!isDevelopment) {
  // Error logs
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  );

  // Combined logs
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  );
}

// ============================================
