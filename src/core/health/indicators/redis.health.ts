// Updated: Redis health indicator

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from '@core/queue';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue(QueueName.SPECIFICATION) private queue: Queue,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();
      const client = this.queue.client;
      await client.ping();
      const responseTime = Date.now() - startTime;

      const info = await client.info();
      const memoryUsed = this.extractMemoryUsage(info);

      return this.getStatus(key, true, {
        type: 'redis',
        responseTime: `${responseTime}ms`,
        memoryUsed,
      });
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          error: error.message,
        }),
      );
    }
  }

  private extractMemoryUsage(info: string): string {
    const match = info.match(/used_memory_human:(.+)/);
    return match ? match[1].trim() : 'unknown';
  }
}

// ============================================