// Updated: LLM health indicator

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { LlmCoreService } from '@core/llm';

@Injectable()
export class LlmHealthIndicator extends HealthIndicator {
  constructor(private llmService: LlmCoreService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const providers = this.llmService.getAvailableProviders();
    const healthy = providers.length > 0;

    return this.getStatus(key, healthy, {
      availableProviders: providers,
      count: providers.length,
    });
  }
}

// ============================================