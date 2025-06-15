//  Context ingestion interfaces

export interface ProcessedContext {
  summary: string;
  keyRequirements: string[];
  technicalDetails: {
    stack?: string[];
    architecture?: string;
    integrations?: string[];
    constraints?: string[];
  };
  userStories?: string[];
  businessRules?: string[];
  metadata: {
    wordCount: number;
    hasImages: boolean;
    complexity: 'simple' | 'moderate' | 'complex';
    confidence: number;
  };
}

export interface ContextEnhancement {
  relatedSpecifications: Array<{
    id: string;
    title: string;
    relevance: number;
    insights: string[];
  }>;
  teamKnowledge: Array<{
    title: string;
    content: string;
    relevance: number;
  }>;
  suggestedTechnologies: string[];
  commonPatterns: string[];
}

export interface ImageAnalysisResult {
  text: string[];
  uiElements?: Array<{
    type: string;
    description: string;
    position?: { x: number; y: number };
  }>;
  layout?: {
    type: 'mobile' | 'desktop' | 'tablet';
    description: string;
  };
  colors?: string[];
  isWireframe: boolean;
  confidence: number;
}

export interface ContextProcessingOptions {
  includeRelatedSpecs?: boolean;
  includeTeamKnowledge?: boolean;
  enhanceWithAI?: boolean;
  extractUserStories?: boolean;
  analyzeComplexity?: boolean;
}

// ============================================
