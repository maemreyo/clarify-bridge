//  Cross-view consistency validator

import { Injectable } from '@nestjs/common';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';
import { QualityIssue, IssueType } from '../interfaces/quality-assurance.interface';

@Injectable()
export class CrossViewValidator {
  validateCrossViewConsistency(views: GeneratedViews): {
    score: number;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];
    let score = 1.0;

    // Check PM to Frontend consistency
    if (views.pmView && views.frontendView) {
      const pmFrontendIssues = this.validatePmToFrontend(views.pmView, views.frontendView);
      issues.push(...pmFrontendIssues);
      score -= pmFrontendIssues.length * 0.05;
    }

    // Check Frontend to Backend consistency
    if (views.frontendView && views.backendView) {
      const frontendBackendIssues = this.validateFrontendToBackend(
        views.frontendView,
        views.backendView,
      );
      issues.push(...frontendBackendIssues);
      score -= frontendBackendIssues.length * 0.05;
    }

    // Check PM to Backend consistency
    if (views.pmView && views.backendView) {
      const pmBackendIssues = this.validatePmToBackend(views.pmView, views.backendView);
      issues.push(...pmBackendIssues);
      score -= pmBackendIssues.length * 0.05;
    }

    return {
      score: Math.max(0, score),
      issues,
    };
  }

  private validatePmToFrontend(
    pmView: GeneratedViews['pmView'],
    frontendView: GeneratedViews['frontendView'],
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check if all user stories have corresponding UI components
    pmView.userStories.forEach(story => {
      const hasComponent = frontendView.components.some(
        comp =>
          comp.description.toLowerCase().includes(story.title.toLowerCase()) ||
          comp.name.toLowerCase().includes(story.title.toLowerCase().replace(/\s+/g, '')),
      );

      if (!hasComponent) {
        issues.push({
          severity: 'major',
          type: IssueType.MISSING_REQUIREMENT,
          view: 'cross-view',
          description: `User story "${story.title}" has no corresponding frontend component`,
          suggestion: 'Create frontend components for all user stories',
        });
      }
    });

    return issues;
  }

  private validateFrontendToBackend(
    frontendView: GeneratedViews['frontendView'],
    backendView: GeneratedViews['backendView'],
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check if frontend routes have backend endpoints
    frontendView.routes.forEach(route => {
      if (route.path === '/' || route.path.includes(':')) return; // Skip root and dynamic routes

      const routeBase = route.path.split('/')[1];
      const hasEndpoint = backendView.endpoints.some(endpoint => endpoint.path.includes(routeBase));

      if (!hasEndpoint) {
        issues.push({
          severity: 'major',
          type: IssueType.MISSING_REQUIREMENT,
          view: 'cross-view',
          description: `Frontend route "${route.path}" has no corresponding backend endpoint`,
          suggestion: 'Create backend endpoints for all frontend routes',
        });
      }
    });

    // Check if state management aligns with data models
    if (frontendView.stateManagement.stores && frontendView.stateManagement.stores.length > 0) {
      frontendView.stateManagement.stores.forEach(store => {
        const storeName = store.replace('Store', '');
        const hasModel = backendView.dataModels.some(
          model => model.name.toLowerCase() === storeName.toLowerCase(),
        );

        if (!hasModel) {
          issues.push({
            severity: 'minor',
            type: IssueType.INCONSISTENT_NAMING,
            view: 'cross-view',
            description: `Frontend store "${store}" has no corresponding data model`,
            suggestion: 'Align frontend stores with backend data models',
          });
        }
      });
    }

    return issues;
  }

  private validatePmToBackend(
    pmView: GeneratedViews['pmView'],
    backendView: GeneratedViews['backendView'],
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check if functional requirements are covered by endpoints
    const crudOperations = ['create', 'read', 'update', 'delete', 'list', 'get', 'add', 'remove'];

    pmView.requirements.functional.forEach(requirement => {
      const requirementLower = requirement.toLowerCase();
      const hasCrudOperation = crudOperations.some(op => requirementLower.includes(op));

      if (hasCrudOperation) {
        // Extract entity from requirement
        const entityMatch = requirement.match(/(\w+)s?\s+(?:management|operations|functionality)/i);
        if (entityMatch) {
          const entity = entityMatch[1];
          const hasEndpoints = backendView.endpoints.some(endpoint =>
            endpoint.path.toLowerCase().includes(entity.toLowerCase()),
          );

          if (!hasEndpoints) {
            issues.push({
              severity: 'major',
              type: IssueType.MISSING_REQUIREMENT,
              view: 'cross-view',
              description: `Functional requirement "${requirement}" has no backend implementation`,
              suggestion: `Add endpoints for ${entity} operations`,
            });
          }
        }
      }
    });

    // Check if non-functional requirements are addressed
    const performanceRequired = pmView.requirements.nonFunctional.some(
      req => req.toLowerCase().includes('performance') || req.toLowerCase().includes('speed'),
    );

    if (performanceRequired && !backendView.infrastructure.caching) {
      issues.push({
        severity: 'minor',
        type: IssueType.PERFORMANCE_CONCERN,
        view: 'cross-view',
        description: 'Performance requirements specified but no caching strategy defined',
        suggestion: 'Consider adding caching infrastructure',
      });
    }

    return issues;
  }
}

// ============================================
