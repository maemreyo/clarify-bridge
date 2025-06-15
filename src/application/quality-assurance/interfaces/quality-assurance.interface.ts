//  Quality assurance interfaces

import { GeneratedViews } from '@application/specification/interfaces/specification.interface';

export interface QualityCheckResult {
  overallScore: number;
  aiSelfScore: number;
  consistencyScore: number;
  completenessScore: number;
  issues: QualityIssue[];
  suggestions: string[];
  requiresHumanReview: boolean;
  detailedScores: {
    pmView: ViewQualityScore;
    frontendView: ViewQualityScore;
    backendView: ViewQualityScore;
    crossViewConsistency: number;
  };
}

export interface QualityIssue {
  severity: 'critical' | 'major' | 'minor';
  type: IssueType;
  view: 'pm' | 'frontend' | 'backend' | 'cross-view';
  description: string;
  location?: string;
  suggestion?: string;
}

export enum IssueType {
  MISSING_REQUIREMENT = 'missing_requirement',
  INCONSISTENT_NAMING = 'inconsistent_naming',
  INCOMPLETE_SPECIFICATION = 'incomplete_specification',
  AMBIGUOUS_REQUIREMENT = 'ambiguous_requirement',
  MISSING_ERROR_HANDLING = 'missing_error_handling',
  SECURITY_CONCERN = 'security_concern',
  PERFORMANCE_CONCERN = 'performance_concern',
  MISSING_VALIDATION = 'missing_validation',
  UNCLEAR_FLOW = 'unclear_flow',
  DATA_MODEL_ISSUE = 'data_model_issue',
}

export interface ViewQualityScore {
  completeness: number;
  clarity: number;
  consistency: number;
  technicalAccuracy: number;
  overall: number;
}

export interface QualityValidationRules {
  minUserStories: number;
  minEndpoints: number;
  minDataModels: number;
  requireAuthentication: boolean;
  requireErrorHandling: boolean;
  requireValidation: boolean;
}

export interface QualityMetrics {
  specificationId: string;
  timestamp: Date;
  scores: QualityCheckResult;
  humanReviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewerNotes?: string;
}

// ============================================
