//  Main quality assurance service

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import { MonitoringService } from '@core/monitoring';
import { PmViewValidator } from './validators/pm-view.validator';
import { FrontendViewValidator } from './validators/frontend-view.validator';
import { BackendViewValidator } from './validators/backend-view.validator';
import { CrossViewValidator } from './validators/cross-view.validator';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';
import { QualityCheckResult, QualityIssue } from './interfaces/quality-assurance.interface';

@Injectable()
export class QualityAssuranceService {
  private readonly logger = new Logger(QualityAssuranceService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmCoreService,
    private monitoringService: MonitoringService,
    private pmValidator: PmViewValidator,
    private frontendValidator: FrontendViewValidator,
    private backendValidator: BackendViewValidator,
    private crossViewValidator: CrossViewValidator,
  ) {}

  /**
   * Perform comprehensive quality check on specification
   */
  async performQualityCheck(
    specificationId: string,
    views: GeneratedViews,
  ): Promise<QualityCheckResult> {
    const startTime = Date.now();

    try {
      // Validate individual views
      const pmValidation = this.pmValidator.validatePmView(views.pmView);
      const frontendValidation = this.frontendValidator.validateFrontendView(views.frontendView);
      const backendValidation = this.backendValidator.validateBackendView(views.backendView);

      // Validate cross-view consistency
      const crossViewValidation = this.crossViewValidator.validateCrossViewConsistency(views);

      // Perform AI self-evaluation
      const aiSelfScore = await this.performAiSelfEvaluation(views);

      // Combine all issues
      const allIssues = [
        ...pmValidation.issues,
        ...frontendValidation.issues,
        ...backendValidation.issues,
        ...crossViewValidation.issues,
      ];

      // Generate suggestions
      const suggestions = await this.generateImprovementSuggestions(allIssues, views);

      // Calculate scores
      const scores = {
        overallScore: this.calculateOverallScore({
          pmScore: pmValidation.score.overall,
          frontendScore: frontendValidation.score.overall,
          backendScore: backendValidation.score.overall,
          crossViewScore: crossViewValidation.score,
          aiSelfScore,
        }),
        aiSelfScore,
        consistencyScore: crossViewValidation.score,
        completenessScore: this.calculateCompletenessScore({
          pmCompleteness: pmValidation.score.completeness,
          frontendCompleteness: frontendValidation.score.completeness,
          backendCompleteness: backendValidation.score.completeness,
        }),
        detailedScores: {
          pmView: pmValidation.score,
          frontendView: frontendValidation.score,
          backendView: backendValidation.score,
          crossViewConsistency: crossViewValidation.score,
        },
      };

      // Determine if human review is required
      const requiresHumanReview = this.shouldRequireHumanReview(scores, allIssues);

      const result: QualityCheckResult = {
        ...scores,
        issues: allIssues,
        suggestions,
        requiresHumanReview,
      };

      // Store quality metrics
      await this.storeQualityMetrics(specificationId, result);

      // Track metrics
      const duration = Date.now() - startTime;
      await this.monitoringService.trackAiGeneration('quality_check', duration, true, {
        overallScore: result.overallScore,
        requiresReview: requiresHumanReview,
      });

      this.logger.log(
        `Quality check completed for ${specificationId}: score ${result.overallScore}`,
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.monitoringService.trackAiGeneration('quality_check', duration, false);

      this.logger.error('Quality check failed', error);
      throw error;
    }
  }

  /**
   * AI self-evaluation of generated content
   */
  private async performAiSelfEvaluation(views: GeneratedViews): Promise<number> {
    const prompt: PromptTemplate = {
      system: `You are a quality assurance expert evaluating technical specifications.
Evaluate the quality, completeness, and consistency of the provided specification views.

Score on a scale of 0.0 to 1.0 based on:
- Completeness of requirements coverage
- Technical accuracy and feasibility
- Consistency across views
- Clarity and lack of ambiguity
- Proper error handling and edge cases
- Security considerations`,

      user: `Evaluate the quality of this specification:

PM View:
${JSON.stringify(views.pmView, null, 2)}

Frontend View:
${JSON.stringify(views.frontendView, null, 2)}

Backend View:
${JSON.stringify(views.backendView, null, 2)}

Provide your evaluation in JSON format:
{
  "score": 0.0-1.0,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "criticalIssues": ["issue1"]
}`,
    };

    try {
      const result = await this.llmService.generateFromTemplate(prompt, {
        temperature: 0.3,
        maxTokens: 1000,
      });

      const evaluation = this.parseAiEvaluation(result.content);
      return evaluation.score;
    } catch (error) {
      this.logger.error('AI self-evaluation failed', error);
      return 0.5; // Default middle score on failure
    }
  }

  /**
   * Generate improvement suggestions based on issues
   */
  private async generateImprovementSuggestions(
    issues: QualityIssue[],
    views: GeneratedViews,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Group issues by type
    const issuesByType = new Map<string, QualityIssue[]>();
    issues.forEach(issue => {
      const key = issue.type;
      if (!issuesByType.has(key)) {
        issuesByType.set(key, []);
      }
      issuesByType.get(key)!.push(issue);
    });

    // Generate suggestions for common issue patterns
    if (issuesByType.has('missing_requirement')) {
      suggestions.push('Add more detailed requirements coverage across all views');
    }

    if (issuesByType.has('security_concern')) {
      suggestions.push('Implement comprehensive authentication and authorization strategies');
    }

    if (issuesByType.has('incomplete_specification')) {
      suggestions.push('Expand specifications with more detailed implementation guidelines');
    }

    // Add specific suggestions from issues
    issues
      .filter(issue => issue.suggestion)
      .forEach(issue => {
        if (!suggestions.includes(issue.suggestion!)) {
          suggestions.push(issue.suggestion!);
        }
      });

    // Limit to top 10 suggestions
    return suggestions.slice(0, 10);
  }

  /**
   * Store quality metrics in database
   */
  private async storeQualityMetrics(
    specificationId: string,
    result: QualityCheckResult,
  ): Promise<void> {
    try {
      await this.prisma.qualityMetrics.create({
        data: {
          specificationId,
          aiSelfScore: result.aiSelfScore,
          consistencyScore: result.consistencyScore,
          completenessScore: result.completenessScore,
          userSatisfaction: null, // Will be updated later based on user feedback
          generationTime: 0, // Should be passed from generation service
        },
      });

      // Update specification with quality score
      await this.prisma.specification.update({
        where: { id: specificationId },
        data: {
          qualityScore: result.overallScore,
          lastReviewedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to store quality metrics', error);
    }
  }

  // Helper methods

  private calculateOverallScore(scores: {
    pmScore: number;
    frontendScore: number;
    backendScore: number;
    crossViewScore: number;
    aiSelfScore: number;
  }): number {
    // Weighted average
    const weights = {
      pm: 0.25,
      frontend: 0.25,
      backend: 0.25,
      crossView: 0.15,
      aiSelf: 0.1,
    };

    return (
      scores.pmScore * weights.pm +
      scores.frontendScore * weights.frontend +
      scores.backendScore * weights.backend +
      scores.crossViewScore * weights.crossView +
      scores.aiSelfScore * weights.aiSelf
    );
  }

  private calculateCompletenessScore(scores: {
    pmCompleteness: number;
    frontendCompleteness: number;
    backendCompleteness: number;
  }): number {
    return (scores.pmCompleteness + scores.frontendCompleteness + scores.backendCompleteness) / 3;
  }

  private shouldRequireHumanReview(scores: QualityCheckResult, issues: QualityIssue[]): boolean {
    // Require review if:
    // 1. Overall score is below threshold
    if (scores.overallScore < 0.7) return true;

    // 2. Any critical issues
    if (issues.some(issue => issue.severity === 'critical')) return true;

    // 3. Too many major issues
    const majorIssues = issues.filter(issue => issue.severity === 'major');
    if (majorIssues.length > 3) return true;

    // 4. Low AI self-confidence
    if (scores.aiSelfScore < 0.6) return true;

    return false;
  }

  private parseAiEvaluation(content: string): {
    score: number;
    strengths: string[];
    weaknesses: string[];
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.max(0, Math.min(1, parsed.score || 0.5)),
          strengths: parsed.strengths || [],
          weaknesses: parsed.weaknesses || [],
        };
      }
    } catch (error) {
      this.logger.error('Failed to parse AI evaluation', error);
    }

    return {
      score: 0.5,
      strengths: [],
      weaknesses: [],
    };
  }
}

// ============================================
