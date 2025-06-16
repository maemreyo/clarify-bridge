//  Main diagram generation service

import { Injectable, Logger } from '@nestjs/common';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import { MonitoringService } from '@core/monitoring';
import { FlowchartGenerator } from './generators/flowchart.generator';
import { SequenceGenerator } from './generators/sequence.generator';
import { EntityRelationshipGenerator } from './generators/entity-relationship.generator';
import {
  DiagramType,
  DiagramGenerationContext,
  GeneratedDiagram,
  DiagramValidationResult,
} from './interfaces/diagram-generation.interface';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';

@Injectable()
export class DiagramGenerationService {
  private readonly logger = new Logger(DiagramGenerationService.name);

  constructor(
    private llmService: LlmCoreService,
    private monitoringService: MonitoringService,
    private flowchartGenerator: FlowchartGenerator,
    private sequenceGenerator: SequenceGenerator,
    private erGenerator: EntityRelationshipGenerator,
  ) {}

  /**
   * Generate diagram from context
   */
  async generateDiagram(context: DiagramGenerationContext): Promise<GeneratedDiagram> {
    const startTime = Date.now();

    try {
      let mermaidSyntax: string;
      let metadata: any = {};

      switch (context.type) {
        case 'flowchart':
          mermaidSyntax = await this.generateFlowchart(context);
          break;
        case 'sequence':
          mermaidSyntax = await this.generateSequenceDiagram(context);
          break;
        case 'er':
          mermaidSyntax = await this.generateERDiagram(context);
          break;
        case 'wireframe':
          mermaidSyntax = await this.generateWireframe(context);
          break;
        default:
          mermaidSyntax = await this.generateWithAI(context);
      }

      // Validate the generated diagram
      const validation = this.validateMermaidSyntax(mermaidSyntax);
      if (!validation.isValid) {
        this.logger.warn('Generated diagram has validation issues', validation.errors);
      }

      // Count nodes for metadata
      const nodeCount = this.countNodes(mermaidSyntax);
      metadata.nodeCount = nodeCount;
      metadata.complexity = nodeCount > 20 ? 'complex' : nodeCount > 10 ? 'moderate' : 'simple';
      metadata.warnings = validation.warnings;

      const duration = Date.now() - startTime;
      await this.monitoringService.trackAiGeneration('diagram_generation', duration, true, {});

      return {
        type: context.type,
        title: context.title,
        mermaidSyntax,
        description: context.description,
        metadata,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.monitoringService.trackAiGeneration('diagram_generation', duration, false);

      this.logger.error('Diagram generation failed', error);
      throw error;
    }
  }

  /**
   * Generate diagrams from specification views
   */
  async generateDiagramsFromViews(views: GeneratedViews): Promise<GeneratedDiagram[]> {
    const diagrams: GeneratedDiagram[] = [];

    // User journey flowchart from PM view
    if (views.pmView?.userStories?.length > 0) {
      const userJourneyDiagram = await this.generateDiagram({
        type: 'flowchart',
        title: 'User Journey Flow',
        description: 'User journey through main features',
        data: views.pmView.userStories,
      });
      diagrams.push(userJourneyDiagram);
    }

    // API sequence diagram from backend view
    if (views.backendView?.endpoints?.length > 0) {
      const sequenceDiagram = await this.generateDiagram({
        type: 'sequence',
        title: 'API Interaction Flow',
        description: 'Sequence of API calls and responses',
        data: views.backendView.endpoints.slice(0, 5), // Limit to 5 for readability
      });
      diagrams.push(sequenceDiagram);
    }

    // ER diagram from data models
    if (views.backendView?.dataModels?.length > 0) {
      const erDiagram = await this.generateDiagram({
        type: 'er',
        title: 'Data Model Relationships',
        description: 'Entity relationship diagram',
        data: views.backendView.dataModels,
      });
      diagrams.push(erDiagram);
    }

    return diagrams;
  }

  /**
   * Generate diagram from text description
   */
  async generateDiagramFromText(
    description: string,
    type: DiagramType = 'flowchart',
  ): Promise<GeneratedDiagram> {
    const prompt: PromptTemplate = {
      system: `You are an expert at creating Mermaid.js diagrams.
Create clear, well-structured ${type} diagrams that accurately represent the described system or process.

Guidelines:
- Use proper Mermaid.js syntax
- Keep labels concise but descriptive
- Organize nodes logically
- Limit complexity for readability
- Follow Mermaid best practices`,

      user: `Create a ${type} diagram for the following description:

${description}

Output only the Mermaid.js syntax, starting with the diagram type declaration.`,
    };

    const result = await this.llmService.generateFromTemplate(prompt, {
      temperature: 0.5,
      maxTokens: 1500,
    });

    const mermaidSyntax = this.extractMermaidSyntax(result.content);

    return {
      type,
      title: `${type} diagram`,
      mermaidSyntax,
      description,
    };
  }

  // Private generator methods

  private async generateFlowchart(context: DiagramGenerationContext): Promise<string> {
    if (Array.isArray(context.data)) {
      // Assuming data is user stories
      return this.flowchartGenerator.generateFromUserStories(context.data);
    }

    // Generate with AI for complex data
    return this.generateWithAI(context);
  }

  private async generateSequenceDiagram(context: DiagramGenerationContext): Promise<string> {
    if (Array.isArray(context.data) && context.data[0]?.method) {
      // Assuming data is endpoints
      return this.sequenceGenerator.generateFromEndpoints(context.data);
    }

    return this.generateWithAI(context);
  }

  private async generateERDiagram(context: DiagramGenerationContext): Promise<string> {
    if (Array.isArray(context.data) && context.data[0]?.fields) {
      // Assuming data is data models
      return this.erGenerator.generateFromDataModels(context.data);
    }

    return this.generateWithAI(context);
  }

  private async generateWireframe(context: DiagramGenerationContext): Promise<string> {
    const prompt: PromptTemplate = {
      system:
        'Create a simple wireframe diagram using Mermaid.js graph syntax to represent UI layout and components.',
      user: `Create a wireframe for: ${context.description}

Data: ${JSON.stringify(context.data, null, 2)}

Use graph TB syntax with rectangular nodes for UI components.`,
    };

    const result = await this.llmService.generateFromTemplate(prompt, {
      temperature: 0.5,
      maxTokens: 1000,
    });

    return this.extractMermaidSyntax(result.content);
  }

  private async generateWithAI(context: DiagramGenerationContext): Promise<string> {
    const prompt: PromptTemplate = {
      system: `Generate a ${context.type} diagram using Mermaid.js syntax.`,
      user: `Title: ${context.title}
Description: ${context.description}
Data: ${JSON.stringify(context.data, null, 2)}

Create a clear, well-structured Mermaid.js ${context.type} diagram.`,
    };

    const result = await this.llmService.generateFromTemplate(prompt, {
      temperature: 0.5,
      maxTokens: 1500,
    });

    return this.extractMermaidSyntax(result.content);
  }

  // Helper methods

  private extractMermaidSyntax(content: string): string {
    // Try to extract from code block
    const codeBlockMatch = content.match(/```(?:mermaid)?\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find diagram declaration
    const diagramMatch = content.match(
      /(graph\s+\w+|sequenceDiagram|classDiagram|stateDiagram|erDiagram|pie|gantt|flowchart\s+\w+)[\s\S]*/,
    );
    if (diagramMatch) {
      return diagramMatch[0].trim();
    }

    // Return as-is if no match
    return content.trim();
  }

  private validateMermaidSyntax(syntax: string): DiagramValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic syntax checks
    if (!syntax || syntax.trim().length === 0) {
      errors.push('Empty diagram syntax');
    }

    // Check for diagram type declaration
    const hasValidStart =
      /^(graph\s+\w+|sequenceDiagram|classDiagram|stateDiagram|erDiagram|pie|gantt|flowchart\s+\w+)/m.test(
        syntax,
      );
    if (!hasValidStart) {
      errors.push('Missing or invalid diagram type declaration');
    }

    // Check for basic syntax errors
    const openBrackets = (syntax.match(/[\[{(]/g) || []).length;
    const closeBrackets = (syntax.match(/[\]})]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Mismatched brackets');
    }

    // Check for very long labels
    const longLabels = syntax.match(/["'][^"']{100,}["']/g);
    if (longLabels) {
      warnings.push('Very long labels detected - consider shortening for readability');
    }

    // Check complexity
    const nodeCount = this.countNodes(syntax);
    if (nodeCount > 50) {
      warnings.push('Diagram has many nodes - consider simplifying');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions:
        warnings.length > 0 ? ['Consider breaking complex diagrams into smaller parts'] : undefined,
    };
  }

  private countNodes(mermaidSyntax: string): number {
    // Simple heuristic to count nodes
    const nodePatterns = [
      /^\s*\w+\[/gm, // Square brackets
      /^\s*\w+\(/gm, // Round brackets
      /^\s*\w+\{/gm, // Curly brackets
      /^\s*\w+\[\(/gm, // Stadium shape
      /^\s*participant\s+/gm, // Sequence diagram participants
      /^\s*actor\s+/gm, // Sequence diagram actors
    ];

    let count = 0;
    nodePatterns.forEach(pattern => {
      const matches = mermaidSyntax.match(pattern);
      if (matches) {
        count += matches.length;
      }
    });

    return count;
  }
}

// ============================================
