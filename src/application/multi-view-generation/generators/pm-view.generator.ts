//  PM view generator implementation

import { Injectable, Logger } from '@nestjs/common';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import {
  ViewGenerationContext,
  ViewGeneratorOptions,
} from '../interfaces/view-generation.interface';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';

@Injectable()
export class PmViewGenerator {
  private readonly logger = new Logger(PmViewGenerator.name);

  constructor(private llmService: LlmCoreService) {}

  async generatePmView(
    context: ViewGenerationContext,
    options: ViewGeneratorOptions = {},
  ): Promise<GeneratedViews['pmView']> {
    const prompt = this.buildPrompt(context, options);

    try {
      const result = await this.llmService.generateFromTemplate(prompt, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 3000,
      });

      const parsed = this.parseResponse(result.content);

      // Generate wireframe if requested
      let wireframes: string | undefined;
      if (context.options?.generateDiagrams) {
        wireframes = await this.generateWireframe(parsed, context);
      }

      return {
        ...parsed,
        wireframes,
      };
    } catch (error) {
      this.logger.error('PM view generation failed', error);
      throw error;
    }
  }

  private buildPrompt(
    context: ViewGenerationContext,
    options: ViewGeneratorOptions,
  ): PromptTemplate {
    const detailLevel = options.detailLevel || 'detailed';

    return {
      system: `You are an expert Product Manager creating comprehensive specifications.
Your role is to translate technical requirements into clear user stories, acceptance criteria, and success metrics.

Guidelines:
- Focus on user value and business outcomes
- Create clear, actionable user stories with specific acceptance criteria
- Define measurable success metrics
- Identify both functional and non-functional requirements
- Consider edge cases and error scenarios
- ${detailLevel === 'comprehensive' ? 'Include detailed scenarios and examples' : ''}
- ${options.includeExamples ? 'Provide concrete examples for each user story' : ''}`,

      user: `Based on the following context and requirements, create a comprehensive PM specification:

=== REQUIREMENTS ===
${context.originalRequirements}

=== ANALYZED CONTEXT ===
Summary: ${context.processed.summary}

Key Requirements:
${context.processed.keyRequirements.map(r => `- ${r}`).join('\n')}

Technical Context:
${JSON.stringify(context.processed.technicalDetails, null, 2)}

${context.processed.userStories ? `Identified User Stories:\n${context.processed.userStories.join('\n')}` : ''}

${context.processed.businessRules ? `Business Rules:\n${context.processed.businessRules.join('\n')}` : ''}

${
  context.enhancement?.relatedSpecifications.length
    ? `
Related Specifications:
${context.enhancement.relatedSpecifications.map(s => `- ${s.title} (${Math.round(s.relevance * 100)}% relevant)`).join('\n')}
`
    : ''
}

=== OUTPUT FORMAT ===
Generate a PM specification in the following JSON format:
{
  "overview": "Executive summary of the feature/product",
  "userStories": [
    {
      "id": "US001",
      "title": "Story title",
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": ["Criteria 1", "Criteria 2"],
      "priority": "high|medium|low"
    }
  ],
  "requirements": {
    "functional": ["Requirement 1", "Requirement 2"],
    "nonFunctional": ["Performance requirement", "Security requirement"]
  },
  "successMetrics": ["Metric 1", "Metric 2"]
}`,
    };
  }

  private parseResponse(content: string): Omit<GeneratedViews['pmView'], 'wireframes'> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and ensure required fields
        return {
          overview: parsed.overview || 'Product specification',
          userStories: this.validateUserStories(parsed.userStories || []),
          requirements: {
            functional: parsed.requirements?.functional || [],
            nonFunctional: parsed.requirements?.nonFunctional || [],
          },
          successMetrics: parsed.successMetrics || [],
        };
      }
    } catch (error) {
      this.logger.error('Failed to parse PM view response', error);
    }

    // Fallback structure
    return {
      overview: 'Product specification generated from requirements',
      userStories: [],
      requirements: {
        functional: [],
        nonFunctional: [],
      },
      successMetrics: [],
    };
  }

  private validateUserStories(stories: any[]): GeneratedViews['pmView']['userStories'] {
    return stories.map((story, index) => ({
      id: story.id || `US${String(index + 1).padStart(3, '0')}`,
      title: story.title || 'User Story',
      description: story.description || '',
      acceptanceCriteria: Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria : [],
      priority: ['high', 'medium', 'low'].includes(story.priority) ? story.priority : 'medium',
    }));
  }

  private async generateWireframe(
    pmView: Omit<GeneratedViews['pmView'], 'wireframes'>,
    context: ViewGenerationContext,
  ): Promise<string> {
    const prompt: PromptTemplate = {
      system: `You are a UX designer creating Mermaid.js wireframe diagrams.
Create simple, clear wireframes that visualize the main user interface components and flow.`,

      user: `Create a Mermaid.js wireframe diagram for the following user stories:

${pmView.userStories.map(story => `- ${story.title}: ${story.description}`).join('\n')}

Use Mermaid graph syntax to show the main screens and navigation flow.
Focus on the primary user journey.`,
    };

    try {
      const result = await this.llmService.generateFromTemplate(prompt, {
        temperature: 0.5,
        maxTokens: 1000,
      });

      // Extract mermaid code
      const mermaidMatch =
        result.content.match(/```mermaid\n([\s\S]*?)\n```/) ||
        result.content.match(/graph\s+\w+\n[\s\S]*/);

      return mermaidMatch ? mermaidMatch[1] || mermaidMatch[0] : '';
    } catch (error) {
      this.logger.error('Wireframe generation failed', error);
      return '';
    }
  }
}

// ============================================
