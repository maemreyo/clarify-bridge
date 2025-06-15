//  Backend view quality validator

import { Injectable } from '@nestjs/common';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';
import {
  QualityIssue,
  IssueType,
  ViewQualityScore,
} from '../interfaces/quality-assurance.interface';

@Injectable()
export class BackendViewValidator {
  validateBackendView(backendView: GeneratedViews['backendView']): {
    score: ViewQualityScore;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];
    const scores = {
      completeness: 1.0,
      clarity: 1.0,
      consistency: 1.0,
      technicalAccuracy: 1.0,
    };

    // Check architecture
    if (!backendView.architecture || backendView.architecture.length < 20) {
      issues.push({
        severity: 'major',
        type: IssueType.INCOMPLETE_SPECIFICATION,
        view: 'backend',
        description: 'Architecture description is missing or too brief',
        suggestion: 'Provide detailed architecture description',
      });
      scores.completeness -= 0.15;
    }

    // Check endpoints
    if (!backendView.endpoints || backendView.endpoints.length === 0) {
      issues.push({
        severity: 'critical',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'backend',
        description: 'No API endpoints defined',
        suggestion: 'Define REST API endpoints',
      });
      scores.completeness -= 0.3;
    } else {
      const authEndpoints = backendView.endpoints.filter(e => e.authentication);

      if (authEndpoints.length === 0) {
        issues.push({
          severity: 'major',
          type: IssueType.SECURITY_CONCERN,
          view: 'backend',
          description: 'No endpoints require authentication',
          suggestion: 'Add authentication to sensitive endpoints',
        });
        scores.technicalAccuracy -= 0.15;
      }

      // Check for proper REST conventions
      backendView.endpoints.forEach((endpoint, index) => {
        if (!this.isValidHttpMethod(endpoint.method)) {
          issues.push({
            severity: 'minor',
            type: IssueType.INCONSISTENT_NAMING,
            view: 'backend',
            description: `Invalid HTTP method: ${endpoint.method}`,
            location: `endpoints[${index}]`,
            suggestion: 'Use standard HTTP methods: GET, POST, PUT, DELETE, PATCH',
          });
          scores.technicalAccuracy -= 0.05;
        }

        if (!endpoint.path.startsWith('/')) {
          issues.push({
            severity: 'minor',
            type: IssueType.INCONSISTENT_NAMING,
            view: 'backend',
            description: `Endpoint path should start with /: ${endpoint.path}`,
            location: `endpoints[${index}]`,
          });
          scores.consistency -= 0.02;
        }
      });
    }

    // Check data models
    if (!backendView.dataModels || backendView.dataModels.length === 0) {
      issues.push({
        severity: 'critical',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'backend',
        description: 'No data models defined',
        suggestion: 'Define database models/entities',
      });
      scores.completeness -= 0.3;
    } else {
      backendView.dataModels.forEach((model, index) => {
        // Check for ID field
        const hasId = model.fields.some(
          f => f.name.toLowerCase() === 'id' || f.name.toLowerCase().endsWith('id'),
        );

        if (!hasId) {
          issues.push({
            severity: 'major',
            type: IssueType.DATA_MODEL_ISSUE,
            view: 'backend',
            description: `Model ${model.name} has no identifier field`,
            location: `dataModels[${index}]`,
            suggestion: 'Add an ID field to the model',
          });
          scores.technicalAccuracy -= 0.1;
        }

        // Check for relationships
        if (!model.relationships || model.relationships.length === 0) {
          if (backendView.dataModels.length > 1) {
            issues.push({
              severity: 'minor',
              type: IssueType.DATA_MODEL_ISSUE,
              view: 'backend',
              description: `Model ${model.name} has no relationships defined`,
              location: `dataModels[${index}]`,
              suggestion: 'Consider if this model relates to others',
            });
          }
        }
      });
    }

    // Check services
    if (!backendView.services || backendView.services.length === 0) {
      issues.push({
        severity: 'major',
        type: IssueType.INCOMPLETE_SPECIFICATION,
        view: 'backend',
        description: 'No services defined',
        suggestion: 'Define business logic services',
      });
      scores.completeness -= 0.2;
    }

    // Check infrastructure
    if (!backendView.infrastructure.database) {
      issues.push({
        severity: 'critical',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'backend',
        description: 'Database not specified',
        suggestion: 'Specify database technology',
      });
      scores.completeness -= 0.1;
    }

    // Calculate overall score
    const overall =
      scores.completeness * 0.4 +
      scores.clarity * 0.2 +
      scores.consistency * 0.2 +
      scores.technicalAccuracy * 0.2;

    return {
      score: {
        ...scores,
        overall,
      },
      issues,
    };
  }

  private isValidHttpMethod(method: string): boolean {
    return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method);
  }
}

// ============================================
