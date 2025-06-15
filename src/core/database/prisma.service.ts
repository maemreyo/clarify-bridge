//  Complete Prisma service implementation

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const logLevel = configService.get('NODE_ENV') === 'production' ? 'error' : 'query';

    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'minimal',
    });

    // Log database queries in development
    if (configService.get('NODE_ENV') !== 'production') {
      this.$on('query' as any, (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async executeTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    try {
      return await this.$transaction(fn);
    } catch (error) {
      this.logger.error('Transaction failed', error);
      throw error;
    }
  }

  /**
   * Clear all data (useful for testing)
   */
  async clearDatabase() {
    if (this.configService.get('NODE_ENV') === 'production') {
      throw new Error('Cannot clear database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      key => key[0] !== '_' && key[0] !== '$' && typeof key === 'string',
    ) as string[];

    return Promise.all(
      models.map(model => {
        if (this[model]?.deleteMany) {
          return this[model].deleteMany();
        }
      }),
    );
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}

// ============================================
