// Updated: Specification interfaces and types

export interface SpecificationContext {
  rawInput: string;
  attachments?: string[];
  references?: string[];
  constraints?: string[];
  technicalStack?: string[];
  teamKnowledge?: any[];
  relatedSpecs?: any[];
}

export interface GeneratedViews {
  pmView: {
    overview: string;
    userStories: Array<{
      id: string;
      title: string;
      description: string;
      acceptanceCriteria: string[];
      priority: 'high' | 'medium' | 'low';
    }>;
    wireframes?: string; // Mermaid syntax
    requirements: {
      functional: string[];
      nonFunctional: string[];
    };
    successMetrics: string[];
  };

  frontendView: {
    overview: string;
    components: Array<{
      name: string;
      description: string;
      props?: string[];
      state?: string[];
      interactions: string[];
    }>;
    routes: Array<{
      path: string;
      component: string;
      description: string;
      guards?: string[];
    }>;
    stateManagement: {
      approach: string;
      stores?: string[];
      description: string;
    };
    uiux: {
      designSystem: string;
      keyInteractions: string[];
      responsiveness: string[];
    };
  };

  backendView: {
    overview: string;
    architecture: string;
    endpoints: Array<{
      method: string;
      path: string;
      description: string;
      requestBody?: any;
      responseBody?: any;
      authentication: boolean;
    }>;
    dataModels: Array<{
      name: string;
      description: string;
      fields: Array<{
        name: string;
        type: string;
        required: boolean;
        description?: string;
      }>;
      relationships?: string[];
    }>;
    services: Array<{
      name: string;
      description: string;
      methods: string[];
      dependencies: string[];
    }>;
    infrastructure: {
      database: string;
      caching?: string;
      queuing?: string;
      deployment: string;
    };
  };
}

export interface QualityCheckResult {
  overallScore: number;
  aiSelfScore: number;
  consistencyScore: number;
  completenessScore: number;
  issues: string[];
  suggestions: string[];
  requiresHumanReview: boolean;
}

// ============================================