// Updated: View generation interfaces

import { GeneratedViews } from '@application/specification/interfaces/specification.interface';
import { ProcessedContext, ContextEnhancement } from '@application/context-ingestion';

export interface ViewGenerationContext {
  processed: ProcessedContext;
  enhancement?: ContextEnhancement;
  originalRequirements: string;
  options?: {
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
    includeExamples?: boolean;
    generateDiagrams?: boolean;
  };
}

export interface ViewGenerationResult {
  views: GeneratedViews;
  metadata: {
    generationTime: number;
    tokensUsed: number;
    confidence: number;
    provider: string;
  };
}

export interface ViewGeneratorOptions {
  temperature?: number;
  maxTokens?: number;
  includeExamples?: boolean;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
}

export interface ViewSpecificPrompts {
  pmView: {
    system: string;
    userTemplate: string;
  };
  frontendView: {
    system: string;
    userTemplate: string;
  };
  backendView: {
    system: string;
    userTemplate: string;
  };
}

// ============================================