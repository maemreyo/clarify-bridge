// Updated: PM view quality validator

import { Injectable } from '@nestjs/common';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';
import { QualityIssue, IssueType, ViewQualityScore } from '../interfaces/quality-assurance.interface';

@Injectable()
export class PmViewValidator {
  validatePmView(pmView: GeneratedViews['pmView']): {
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

    // Check overview
    if (!pmView.overview || pmView.overview.length < 50) {
      issues.push({
        severity: 'major',
        type: IssueType.INCOMPLETE_SPECIFICATION,
        view: 'pm',
        description: 'Overview is missing or too brief',
        suggestion: 'Add a comprehensive overview of the feature/product',
      });
      scores.completeness -= 0.2;
    }

    // Check user stories
    if (!pmView.userStories || pmView.userStories.length === 0) {
      issues.push({
        severity: 'critical',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'pm',
        description: 'No user stories defined',
        suggestion: 'Add at least 3-5 user stories covering main features',
      });
      scores.completeness -= 0.3;
    } else {
      // Validate each user story
      pmView.userStories.forEach((story, index) => {
        if (!story.description || !story.description.includes('As a')) {
          issues.push({
            severity: 'minor',
            type: IssueType.UNCLEAR_FLOW,
            view: 'pm',
            description: `User story ${story.id} doesn't follow standard format`,
            location: `userStories[${index}]`,
            suggestion: 'Use format: "As a [user], I want [feature] so that [benefit]"',
          });
          scores.clarity -= 0.05;
        }

        if (!story.acceptanceCriteria || story.acceptanceCriteria.length < 2) {
          issues.push({
            severity: 'major',
            type: IssueType.INCOMPLETE_SPECIFICATION,
            view: 'pm',
            description: `User story ${story.id} lacks sufficient acceptance criteria`,
            location: `userStories[${index}]`,
            suggestion: 'Add at least 2-3 specific acceptance criteria',
          });
          scores.completeness -= 0.1;
        }
      });
    }

    // Check requirements
    if (!pmView.requirements.functional || pmView.requirements.functional.length < 3) {
      issues.push({
        severity: 'major',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'pm',
        description: 'Insufficient functional requirements',
        suggestion: 'Add more detailed functional requirements',
      });
      scores.completeness -= 0.15;
    }

    if (!pmView.requirements.nonFunctional || pmView.requirements.nonFunctional.length === 0) {
      issues.push({
        severity: 'minor',
        type: IssueType.MISSING_REQUIREMENT,
        view: 'pm',
        description: 'No non-functional requirements specified',
        suggestion: 'Add performance, security, and usability requirements',
      });
      scores.completeness -= 0.1;
    }

    // Check success metrics
    if (!pmView.successMetrics || pmView.successMetrics.length === 0) {
      issues.push({
        severity: 'major',
        type: IssueType.INCOMPLETE_SPECIFICATION,
        view: 'pm',
        description: 'No success metrics defined',
        suggestion: 'Add measurable success metrics for the feature',
      });
      scores.completeness -= 0.15;
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