// Updated: Main context ingestion service

import { Injectable, Logger } from '@nestjs/common';
import { VectorDbService } from '@core/vector-db';
import { MonitoringService } from '@core/monitoring';
import { TextProcessor } from './processors/text-processor';
import { ImageProcessor } from './processors/image-processor';
import {
  ProcessedContext,
  ContextEnhancement,
  ContextProcessingOptions,
} from './interfaces/context-ingestion.interface';

@Injectable()
export class ContextIngestionService {
  private readonly logger = new Logger(ContextIngestionService.name);

  constructor(
    private vectorDbService: VectorDbService,
    private monitoringService: MonitoringService,
    private textProcessor: TextProcessor,
    private imageProcessor: ImageProcessor,
  ) {}

  /**
   * Process and analyze input context
   */
  async processContext(
    input: {
      text: string;
      attachments?: Array<{
        type: 'image' | 'document';
        data: Buffer | string;
        mimeType: string;
      }>;
      userId?: string;
      teamId?: string;
    },
    options: ContextProcessingOptions = {},
  ): Promise<{
    processed: ProcessedContext;
    enhancement?: ContextEnhancement;
  }> {
    const startTime = Date.now();

    try {
      // Process main text
      const processed = await this.textProcessor.processText(input.text, {
        extractUserStories: options.extractUserStories,
        analyzeComplexity: options.analyzeComplexity,
      });

      // Process attachments
      if (input.attachments && input.attachments.length > 0) {
        for (const attachment of input.attachments) {
          if (attachment.type === 'image') {
            const imageAnalysis = await this.imageProcessor.processImage(
              attachment.data,
              attachment.mimeType,
            );

            // Merge image analysis into processed context
            processed.metadata.hasImages = true;

            // Add extracted text to requirements
            if (imageAnalysis.text.length > 0) {
              processed.keyRequirements.push(
                ...imageAnalysis.text.map(t => `[From image] ${t}`),
              );
            }

            // Add UI elements to technical details
            if (imageAnalysis.uiElements) {
              processed.technicalDetails.uiComponents = imageAnalysis.uiElements.map(
                el => el.description,
              );
            }
          }
        }
      }

      // Enhance context if requested
      let enhancement: ContextEnhancement | undefined;
      if (options.includeRelatedSpecs || options.includeTeamKnowledge) {
        enhancement = await this.enhanceContext(
          processed,
          {
            userId: input.userId,
            teamId: input.teamId,
            includeRelatedSpecs: options.includeRelatedSpecs,
            includeTeamKnowledge: options.includeTeamKnowledge,
          },
        );
      }

      // Track metrics
      const duration = Date.now() - startTime;
      await this.monitoringService.trackAiGeneration(
        'context_processing',
        duration,
        true,
        {
          userId: input.userId,
          teamId: input.teamId,
        },
      );

      return {
        processed,
        enhancement,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.monitoringService.trackAiGeneration(
        'context_processing',
        duration,
        false,
      );

      this.logger.error('Context processing failed', error);
      throw error;
    }
  }

  /**
   * Enhance context with related information
   */
  async enhanceContext(
    processed: ProcessedContext,
    options: {
      userId?: string;
      teamId?: string;
      includeRelatedSpecs?: boolean;
      includeTeamKnowledge?: boolean;
    },
  ): Promise<ContextEnhancement> {
    const enhancement: ContextEnhancement = {
      relatedSpecifications: [],
      teamKnowledge: [],
      suggestedTechnologies: [],
      commonPatterns: [],
    };

    // Search for related specifications
    if (options.includeRelatedSpecs) {
      const searchQuery = `${processed.summary} ${processed.keyRequirements.slice(0, 3).join(' ')}`;

      const relatedSpecs = await this.vectorDbService.searchSimilar(searchQuery, {
        type: 'specification',
        teamId: options.teamId,
        userId: options.teamId ? undefined : options.userId,
        topK: 5,
        minScore: 0.7,
      });

      enhancement.relatedSpecifications = relatedSpecs.map(spec => ({
        id: spec.metadata?.specificationId || spec.id,
        title: spec.metadata?.title || 'Unknown',
        relevance: spec.score,
        insights: this.extractInsights(spec.content),
      }));
    }

    // Search team knowledge base
    if (options.includeTeamKnowledge && options.teamId) {
      const knowledgeResults = await this.vectorDbService.searchTeamKnowledge(
        options.teamId,
        processed.summary,
        {
          topK: 3,
          minScore: 0.6,
        },
      );

      enhancement.teamKnowledge = knowledgeResults.map(result => ({
        title: result.metadata?.title || 'Team Knowledge',
        content: result.content || '',
        relevance: result.score,
      }));
    }

    // Extract suggested technologies from related content
    if (enhancement.relatedSpecifications.length > 0) {
      const allTech = new Set<string>();

      for (const spec of enhancement.relatedSpecifications) {
        const entities = await this.textProcessor.extractEntities(spec.insights.join(' '));
        entities.technologies.forEach(tech => allTech.add(tech));
      }

      enhancement.suggestedTechnologies = Array.from(allTech).slice(0, 10);
    }

    // Identify common patterns
    enhancement.commonPatterns = this.identifyPatterns(
      processed,
      enhancement.relatedSpecifications,
    );

    return enhancement;
  }

  /**
   * Store processed context for future reference
   */
  async storeContext(
    context: ProcessedContext,
    metadata: {
      userId?: string;
      teamId?: string;
      specificationId?: string;
      title: string;
    },
  ): Promise<string> {
    const content = [
      context.summary,
      ...context.keyRequirements,
      ...context.userStories || [],
      ...context.businessRules || [],
    ].join('\n');

    return this.vectorDbService.storeDocument({
      title: metadata.title,
      content,
      type: 'context',
      userId: metadata.userId,
      teamId: metadata.teamId,
      specificationId: metadata.specificationId,
      metadata: {
        complexity: context.metadata.complexity,
        confidence: context.metadata.confidence,
      },
    });
  }

  // Private helper methods

  private extractInsights(content: string): string[] {
    // Extract key insights from content
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());

    // Prioritize sentences with key terms
    const keyTerms = ['approach', 'solution', 'pattern', 'architecture', 'design', 'implementation'];

    const insights = sentences
      .filter(sentence => {
        const lower = sentence.toLowerCase();
        return keyTerms.some(term => lower.includes(term));
      })
      .slice(0, 3);

    return insights.length > 0 ? insights : sentences.slice(0, 3);
  }

  private identifyPatterns(
    processed: ProcessedContext,
    relatedSpecs: Array<{ insights: string[] }>,
  ): string[] {
    const patterns: string[] = [];

    // Check for common architectural patterns
    const architectureKeywords = {
      'microservices': ['microservice', 'service', 'api gateway'],
      'monolithic': ['monolith', 'single application'],
      'serverless': ['lambda', 'function', 'serverless'],
      'event-driven': ['event', 'message', 'queue', 'pub/sub'],
    };

    const allText = [
      processed.summary,
      ...processed.keyRequirements,
      ...relatedSpecs.flatMap(s => s.insights),
    ].join(' ').toLowerCase();

    Object.entries(architectureKeywords).forEach(([pattern, keywords]) => {
      if (keywords.some(keyword => allText.includes(keyword))) {
        patterns.push(pattern);
      }
    });

    // Check for common feature patterns
    const featurePatterns = {
      'authentication': ['login', 'auth', 'jwt', 'oauth'],
      'crud-operations': ['create', 'read', 'update', 'delete', 'crud'],
      'real-time': ['real-time', 'websocket', 'live', 'push'],
      'file-upload': ['upload', 'file', 'attachment', 'media'],
    };

    Object.entries(featurePatterns).forEach(([pattern, keywords]) => {
      if (keywords.some(keyword => allText.includes(keyword))) {
        patterns.push(pattern);
      }
    });

    return [...new Set(patterns)];
  }
}

// ============================================