// Updated: Diagram generation interfaces

export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'userJourney'
  | 'gantt'
  | 'pie'
  | 'gitGraph'
  | 'wireframe';

export interface DiagramGenerationContext {
  type: DiagramType;
  title: string;
  description: string;
  data: any;
  options?: DiagramOptions;
}

export interface DiagramOptions {
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  includeStyles?: boolean;
  maxNodes?: number;
  simplified?: boolean;
}

export interface GeneratedDiagram {
  type: DiagramType;
  title: string;
  mermaidSyntax: string;
  description?: string;
  metadata?: {
    nodeCount: number;
    complexity: 'simple' | 'moderate' | 'complex';
    warnings?: string[];
  };
}

export interface DiagramValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

// ============================================