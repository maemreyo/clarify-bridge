//  Main multi-view generation service

import { Injectable, Logger } from '@nestjs/common';
import { MonitoringService } from '@core/monitoring';
import { PmViewGenerator } from './generators/pm-view.generator';
import { FrontendViewGenerator } from './generators/frontend-view.generator';
import { BackendViewGenerator } from './generators/backend-view.generator';
import {
  ViewGenerationContext,
  ViewGenerationResult,
  ViewGeneratorOptions,
} from './interfaces/view-generation.interface';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';

@Injectable()
export class MultiViewGenerationService {
  private readonly logger = new Logger(MultiViewGenerationService.name);

  constructor(
    private monitoringService: MonitoringService,
    private pmViewGenerator: PmViewGenerator,
    private frontendViewGenerator: FrontendViewGenerator,
    private backendViewGenerator: BackendViewGenerator,
  ) {}

  /**
   * Generate all three views from processed context
   */
  async generateAllViews(
    context: ViewGenerationContext,
    options?: {
      parallel?: boolean;
      views?: ('pm' | 'frontend' | 'backend')[];
    },
  ): Promise<ViewGenerationResult> {
    const startTime = Date.now();
    let tokensUsed = 0;
    let provider = 'unknown';

    try {
      const viewsToGenerate = options?.views || ['pm', 'frontend', 'backend'];
      const generatorOptions: ViewGeneratorOptions = {
        detailLevel: context.options?.detailLevel,
        includeExamples: context.options?.includeExamples,
      };

      let views: Partial<GeneratedViews>;

      if (options?.parallel) {
        // Generate views in parallel
        const promises: Promise<any>[] = [];

        if (viewsToGenerate.includes('pm')) {
          promises.push(this.pmViewGenerator.generatePmView(context, generatorOptions));
        }
        if (viewsToGenerate.includes('frontend')) {
          promises.push(this.frontendViewGenerator.generateFrontendView(context, generatorOptions));
        }
        if (viewsToGenerate.includes('backend')) {
          promises.push(this.backendViewGenerator.generateBackendView(context, generatorOptions));
        }

        const results = await Promise.all(promises);

        views = {};
        let index = 0;
        if (viewsToGenerate.includes('pm')) {
          views.pmView = results[index++];
        }
        if (viewsToGenerate.includes('frontend')) {
          views.frontendView = results[index++];
        }
        if (viewsToGenerate.includes('backend')) {
          views.backendView = results[index++];
        }
      } else {
        // Generate views sequentially
        views = {};

        if (viewsToGenerate.includes('pm')) {
          views.pmView = await this.pmViewGenerator.generatePmView(context, generatorOptions);
        }
        if (viewsToGenerate.includes('frontend')) {
          views.frontendView = await this.frontendViewGenerator.generateFrontendView(
            context,
            generatorOptions,
          );
        }
        if (viewsToGenerate.includes('backend')) {
          views.backendView = await this.backendViewGenerator.generateBackendView(
            context,
            generatorOptions,
          );
        }
      }

      // Estimate tokens (rough calculation)
      tokensUsed = this.estimateTokens(views);

      const duration = Date.now() - startTime;

      // Track metrics
      await this.monitoringService.trackAiGeneration('multi_view_generation', duration, true, {
        tokens: tokensUsed,
      });

      this.logger.log(`Generated ${viewsToGenerate.length} views in ${duration}ms`);

      return {
        views: views as GeneratedViews,
        metadata: {
          generationTime: duration,
          tokensUsed,
          confidence: this.calculateConfidence(views),
          provider,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.monitoringService.trackAiGeneration('multi_view_generation', duration, false);

      this.logger.error('Multi-view generation failed', error);
      throw error;
    }
  }

  /**
   * Generate a single view
   */
  async generateSingleView(
    viewType: 'pm' | 'frontend' | 'backend',
    context: ViewGenerationContext,
    options?: ViewGeneratorOptions,
  ): Promise<GeneratedViews[keyof GeneratedViews]> {
    const startTime = Date.now();

    try {
      let view: any;

      switch (viewType) {
        case 'pm':
          view = await this.pmViewGenerator.generatePmView(context, options);
          break;
        case 'frontend':
          view = await this.frontendViewGenerator.generateFrontendView(context, options);
          break;
        case 'backend':
          view = await this.backendViewGenerator.generateBackendView(context, options);
          break;
      }

      const duration = Date.now() - startTime;

      await this.monitoringService.trackAiGeneration(`${viewType}_view_generation`, duration, true);

      return view;
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.monitoringService.trackAiGeneration(
        `${viewType}_view_generation`,
        duration,
        false,
      );

      throw error;
    }
  }

  /**
   * Regenerate specific sections of a view
   */
  async regenerateViewSection(
    viewType: 'pm' | 'frontend' | 'backend',
    section: string,
    context: ViewGenerationContext,
    currentView: any,
    improvements?: string[],
  ): Promise<any> {
    // This would be implemented to regenerate specific sections
    // For now, regenerate the entire view
    this.logger.log(`Regenerating ${section} section of ${viewType} view`);

    return this.generateSingleView(viewType, context, {
      detailLevel: 'comprehensive',
    });
  }

  /**
   * Validate generated views for consistency
   */
  validateViewConsistency(views: GeneratedViews): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if all required user stories have corresponding frontend components
    if (views.pmView && views.frontendView) {
      const storyIds = new Set(views.pmView.userStories.map(s => s.id));
      const hasAllComponents = views.pmView.userStories.every(story =>
        views.frontendView.components.some(comp =>
          comp.description.toLowerCase().includes(story.title.toLowerCase()),
        ),
      );

      if (!hasAllComponents) {
        issues.push('Not all user stories have corresponding frontend components');
      }
    }

    // Check if frontend routes have corresponding backend endpoints
    if (views.frontendView && views.backendView) {
      views.frontendView.routes.forEach(route => {
        const hasEndpoint = views.backendView.endpoints.some(
          endpoint => endpoint.path.includes(route.path.split('/')[1]), // Simple check
        );

        if (!hasEndpoint && route.path !== '/') {
          issues.push(`No backend endpoint found for route: ${route.path}`);
        }
      });
    }

    // Check if data models support all requirements
    if (views.backendView && views.pmView) {
      const requiredEntities = this.extractEntitiesFromRequirements(
        views.pmView.requirements.functional,
      );

      requiredEntities.forEach(entity => {
        const hasModel = views.backendView.dataModels.some(model =>
          model.name.toLowerCase().includes(entity.toLowerCase()),
        );

        if (!hasModel) {
          issues.push(`No data model found for entity: ${entity}`);
        }
      });
    }

    return {
      isConsistent: issues.length === 0,
      issues,
    };
  }

  // Private helper methods

  private estimateTokens(views: Partial<GeneratedViews>): number {
    const text = JSON.stringify(views);
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private calculateConfidence(views: Partial<GeneratedViews>): number {
    let confidence = 0.5;

    if (views.pmView?.userStories?.length > 0) confidence += 0.1;
    if (views.frontendView?.components?.length > 0) confidence += 0.1;
    if (views.backendView?.endpoints?.length > 0) confidence += 0.1;
    if (views.backendView?.dataModels?.length > 0) confidence += 0.1;

    // Check completeness
    if (views.pmView && views.frontendView && views.backendView) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private extractEntitiesFromRequirements(requirements: string[]): string[] {
    const entities: Set<string> = new Set();
    const entityPatterns = [
      /(?:user|customer|client|admin|manager)/gi,
      /(?:product|item|service|order|payment)/gi,
      /(?:account|profile|settings|configuration)/gi,
    ];

    requirements.forEach(req => {
      entityPatterns.forEach(pattern => {
        const matches = req.match(pattern);
        if (matches) {
          matches.forEach(match => entities.add(match.toLowerCase()));
        }
      });
    });

    return Array.from(entities);
  }
}

// ============================================
