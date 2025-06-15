// Updated: Frontend view generator implementation

import { Injectable, Logger } from '@nestjs/common';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import { ViewGenerationContext, ViewGeneratorOptions } from '../interfaces/view-generation.interface';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';

@Injectable()
export class FrontendViewGenerator {
  private readonly logger = new Logger(FrontendViewGenerator.name);

  constructor(private llmService: LlmCoreService) {}

  async generateFrontendView(
    context: ViewGenerationContext,
    options: ViewGeneratorOptions = {},
  ): Promise<GeneratedViews['frontendView']> {
    const prompt = this.buildPrompt(context, options);

    try {
      const result = await this.llmService.generateFromTemplate(prompt, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 3000,
      });

      return this.parseResponse(result.content);
    } catch (error) {
      this.logger.error('Frontend view generation failed', error);
      throw error;
    }
  }

  private buildPrompt(
    context: ViewGenerationContext,
    options: ViewGeneratorOptions,
  ): PromptTemplate {
    const detailLevel = options.detailLevel || 'detailed';
    const techStack = context.processed.technicalDetails.stack || [];

    return {
      system: `You are an expert Frontend Developer creating technical specifications.
Your role is to design the frontend architecture, components, and user interactions.

${techStack.length > 0 ? `Technology Stack: ${techStack.join(', ')}` : 'Use modern web technologies (React/Vue/Angular)'}

Guidelines:
- Design reusable, modular components
- Plan clear state management strategy
- Consider responsive design and accessibility
- Define routing and navigation structure
- Include error handling and loading states
- ${detailLevel === 'comprehensive' ? 'Include detailed component props and state' : ''}
- ${options.includeExamples ? 'Provide code examples for key components' : ''}`,

      user: `Based on the following context and requirements, create a comprehensive Frontend specification:

=== REQUIREMENTS ===
${context.originalRequirements}

=== ANALYZED CONTEXT ===
${context.processed.summary}

Key Features:
${context.processed.keyRequirements.map(r => `- ${r}`).join('\n')}

${context.processed.technicalDetails.uiComponents ? `
UI Components Identified:
${context.processed.technicalDetails.uiComponents.join('\n')}
` : ''}

${context.enhancement?.suggestedTechnologies.length ? `
Suggested Technologies:
${context.enhancement.suggestedTechnologies.filter(t =>
  ['react', 'vue', 'angular', 'nextjs', 'typescript', 'tailwind', 'material-ui'].includes(t.toLowerCase())
).join(', ')}
` : ''}

=== OUTPUT FORMAT ===
Generate a Frontend specification in the following JSON format:
{
  "overview": "Frontend architecture overview",
  "components": [
    {
      "name": "ComponentName",
      "description": "Component purpose and functionality",
      "props": ["prop1: type", "prop2: type"],
      "state": ["state1: type", "state2: type"],
      "interactions": ["User interaction 1", "Event handling"]
    }
  ],
  "routes": [
    {
      "path": "/route-path",
      "component": "ComponentName",
      "description": "Page purpose",
      "guards": ["AuthGuard", "RoleGuard"]
    }
  ],
  "stateManagement": {
    "approach": "Redux/Context/Zustand/etc",
    "stores": ["UserStore", "DataStore"],
    "description": "State management strategy"
  },
  "uiux": {
    "designSystem": "Material-UI/Tailwind/Custom",
    "keyInteractions": ["Interaction pattern 1"],
    "responsiveness": ["Mobile-first approach", "Breakpoint strategy"]
  }
}`,
    };
  }

  private parseResponse(content: string): GeneratedViews['frontendView'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          overview: parsed.overview || 'Frontend architecture specification',
          components: this.validateComponents(parsed.components || []),
          routes: this.validateRoutes(parsed.routes || []),
          stateManagement: {
            approach: parsed.stateManagement?.approach || 'Context API',
            stores: parsed.stateManagement?.stores || [],
            description: parsed.stateManagement?.description || 'State management strategy',
          },
          uiux: {
            designSystem: parsed.uiux?.designSystem || 'Modern design system',
            keyInteractions: parsed.uiux?.keyInteractions || [],
            responsiveness: parsed.uiux?.responsiveness || ['Responsive design'],
          },
        };
      }
    } catch (error) {
      this.logger.error('Failed to parse Frontend view response', error);
    }

    // Fallback structure
    return {
      overview: 'Frontend specification',
      components: [],
      routes: [],
      stateManagement: {
        approach: 'Context API',
        stores: [],
        description: 'State management',
      },
      uiux: {
        designSystem: 'Modern design system',
        keyInteractions: [],
        responsiveness: ['Responsive design'],
      },
    };
  }

  private validateComponents(components: any[]): GeneratedViews['frontendView']['components'] {
    return components.map(comp => ({
      name: comp.name || 'Component',
      description: comp.description || '',
      props: Array.isArray(comp.props) ? comp.props : [],
      state: Array.isArray(comp.state) ? comp.state : [],
      interactions: Array.isArray(comp.interactions) ? comp.interactions : [],
    }));
  }

  private validateRoutes(routes: any[]): GeneratedViews['frontendView']['routes'] {
    return routes.map(route => ({
      path: route.path || '/',
      component: route.component || 'Component',
      description: route.description || '',
      guards: Array.isArray(route.guards) ? route.guards : [],
    }));
  }
}

// ============================================