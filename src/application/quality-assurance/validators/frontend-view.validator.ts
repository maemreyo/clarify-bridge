// Updated: Frontend view quality validator

import { Injectable } from '@nestjs/common';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';
import { QualityIssue, IssueType, ViewQualityScore } from '../interfaces/quality-assurance.interface';

@Injectable()
export class FrontendViewValidator {
  validateFrontendView(frontendView: GeneratedViews['frontendView']): {
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

    // Check components
    if (!frontendView.components || frontendView.components.length === 0) {
      issues.push({
        severity: 'critical',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'frontend',
        description: 'No components defined',
        suggestion: 'Define UI components for the application',
      });
      scores.completeness -= 0.3;
    } else {
      frontendView.components.forEach((component, index) => {
        // Check for proper component definition
        if (!component.props || component.props.length === 0) {
          issues.push({
            severity: 'minor',
            type: IssueType.INCOMPLETE_SPECIFICATION,
            view: 'frontend',
            description: `Component ${component.name} has no props defined`,
            location: `components[${index}]`,
            suggestion: 'Consider if this component needs props for flexibility',
          });
        }

        if (!component.interactions || component.interactions.length === 0) {
          issues.push({
            severity: 'major',
            type: IssueType.MISSING_REQUIREMENT,
            view: 'frontend',
            description: `Component ${component.name} has no interactions defined`,
            location: `components[${index}]`,
            suggestion: 'Define user interactions and event handlers',
          });
          scores.completeness -= 0.05;
        }
      });
    }

    // Check routes
    if (!frontendView.routes || frontendView.routes.length === 0) {
      issues.push({
        severity: 'critical',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'frontend',
        description: 'No routes defined',
        suggestion: 'Define application routes and navigation',
      });
      scores.completeness -= 0.2;
    } else {
      // Check for authentication on routes
      const protectedRoutes = frontendView.routes.filter(r =>
        r.guards && r.guards.length > 0
      );

      if (protectedRoutes.length === 0) {
        issues.push({
          severity: 'major',
          type: IssueType.SECURITY_CONCERN,
          view: 'frontend',
          description: 'No protected routes defined',
          suggestion: 'Consider adding authentication guards to sensitive routes',
        });
        scores.technicalAccuracy -= 0.1;
      }
    }

    // Check state management
    if (!frontendView.stateManagement.approach) {
      issues.push({
        severity: 'major',
        type: IssueType.INCOMPLETE_SPECIFICATION,
        view: 'frontend',
        description: 'State management approach not specified',
        suggestion: 'Define how application state will be managed',
      });
      scores.completeness -= 0.15;
    }

    // Check UI/UX considerations
    if (!frontendView.uiux.responsiveness || frontendView.uiux.responsiveness.length === 0) {
      issues.push({
        severity: 'major',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'frontend',
        description: 'No responsive design considerations',
        suggestion: 'Add responsive design strategy for different screen sizes',
      });
      scores.technicalAccuracy -= 0.1;
    }

    // Calculate overall score
    const overall = (
      scores.completeness * 0.4 +
      scores.clarity * 0.2 +
      scores.consistency * 0.2 +
      scores.technicalAccuracy * 0.2
    );

    return {
      score: {
        ...scores,
        overall,
      },
      issues,
    };
  }
}

// ============================================