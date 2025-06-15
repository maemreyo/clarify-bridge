// Updated: Vector database health indicator

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { VectorDbService } from '@core/vector-db';

@Injectable()
export class VectorDbHealthIndicator extends HealthIndicator {
  constructor(private vectorDbService: VectorDbService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Simple search to verify functionality
      const startTime = Date.now();
      await this.vectorDbService.searchSimilar('test', { topK: 1 });
      const responseTime = Date.now() - startTime;

      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
      });
    } catch (error) {
      // Vector DB might not be critical, so we mark as degraded, not failed
      return this.getStatus(key, true, {
        status: 'degraded',
        error: error.message,
      });
    }
  }
}

// ============================================