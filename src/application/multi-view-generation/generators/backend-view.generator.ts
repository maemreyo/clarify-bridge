// Updated: Backend view generator implementation

import { Injectable, Logger } from '@nestjs/common';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import { ViewGenerationContext, ViewGeneratorOptions } from '../interfaces/view-generation.interface';
import { GeneratedViews } from '@application/specification/interfaces/specification.interface';

@Injectable()
export class BackendViewGenerator {
  private readonly logger = new Logger(BackendViewGenerator.name);

  constructor(private llmService: LlmCoreService) {}

  async generateBackendView(
    context: ViewGenerationContext,
    options: ViewGeneratorOptions = {},
  ): Promise<GeneratedViews['backendView']> {
    const prompt = this.buildPrompt(context, options);

    try {
      const result = await this.llmService.generateFromTemplate(prompt, {
        temperature: options.temperature || 0.7,
        maxTokens: options.maxTokens || 3500,
      });

      return this.parseResponse(result.content);
    } catch (error) {
      this.logger.error('Backend view generation failed', error);
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
      system: `You are an expert Backend Developer creating technical specifications.
Your role is to design the backend architecture, APIs, data models, and infrastructure.

${techStack.length > 0 ? `Technology Stack: ${techStack.join(', ')}` : 'Use modern backend technologies (Node.js/Python/Java)'}

Guidelines:
- Design RESTful APIs following best practices
- Create normalized, efficient data models
- Plan scalable service architecture
- Include authentication and authorization
- Consider performance and security
- ${detailLevel === 'comprehensive' ? 'Include detailed request/response schemas' : ''}
- ${options.includeExamples ? 'Provide code examples for key services' : ''}`,

      user: `Based on the following context and requirements, create a comprehensive Backend specification:

=== REQUIREMENTS ===
${context.originalRequirements}

=== ANALYZED CONTEXT ===
${context.processed.summary}

Key Features:
${context.processed.keyRequirements.map(r => `- ${r}`).join('\n')}

Technical Details:
${JSON.stringify(context.processed.technicalDetails, null, 2)}

${context.processed.businessRules ? `
Business Rules:
${context.processed.businessRules.join('\n')}
` : ''}

${context.enhancement?.commonPatterns.length ? `
Common Patterns Identified:
${context.enhancement.commonPatterns.join(', ')}
` : ''}

=== OUTPUT FORMAT ===
Generate a Backend specification in the following JSON format:
{
  "overview": "Backend architecture overview",
  "architecture": "Microservices/Monolith/Serverless description",
  "endpoints": [
    {
      "method": "GET/POST/PUT/DELETE",
      "path": "/api/endpoint",
      "description": "Endpoint purpose",
      "requestBody": { "field": "type" },
      "responseBody": { "field": "type" },
      "authentication": true
    }
  ],
  "dataModels": [
    {
      "name": "ModelName",
      "description": "Model purpose",
      "fields": [
        {
          "name": "fieldName",
          "type": "string/number/boolean/etc",
          "required": true,
          "description": "Field purpose"
        }
      ],
      "relationships": ["hasMany: OtherModel", "belongsTo: User"]
    }
  ],
  "services": [
    {
      "name": "ServiceName",
      "description": "Service purpose",
      "methods": ["method1", "method2"],
      "dependencies": ["OtherService", "ExternalAPI"]
    }
  ],
  "infrastructure": {
    "database": "PostgreSQL/MongoDB/etc",
    "caching": "Redis/Memcached",
    "queuing": "RabbitMQ/SQS",
    "deployment": "Docker/Kubernetes/Serverless"
  }
}`,
    };
  }

  private parseResponse(content: string): GeneratedViews['backendView'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          overview: parsed.overview || 'Backend architecture specification',
          architecture: parsed.architecture || 'Monolithic architecture',
          endpoints: this.validateEndpoints(parsed.endpoints || []),
          dataModels: this.validateDataModels(parsed.dataModels || []),
          services: this.validateServices(parsed.services || []),
          infrastructure: {
            database: parsed.infrastructure?.database || 'PostgreSQL',
            caching: parsed.infrastructure?.caching,
            queuing: parsed.infrastructure?.queuing,
            deployment: parsed.infrastructure?.deployment || 'Container-based',
          },
        };
      }
    } catch (error) {
      this.logger.error('Failed to parse Backend view response', error);
    }

    // Fallback structure
    return {
      overview: 'Backend specification',
      architecture: 'Monolithic architecture',
      endpoints: [],
      dataModels: [],
      services: [],
      infrastructure: {
        database: 'PostgreSQL',
        deployment: 'Container-based',
      },
    };
  }

  private validateEndpoints(endpoints: any[]): GeneratedViews['backendView']['endpoints'] {
    return endpoints.map(endpoint => ({
      method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(endpoint.method)
        ? endpoint.method : 'GET',
      path: endpoint.path || '/api/resource',
      description: endpoint.description || '',
      requestBody: endpoint.requestBody,
      responseBody: endpoint.responseBody,
      authentication: endpoint.authentication !== false,
    }));
  }

  private validateDataModels(models: any[]): GeneratedViews['backendView']['dataModels'] {
    return models.map(model => ({
      name: model.name || 'Model',
      description: model.description || '',
      fields: Array.isArray(model.fields) ? model.fields.map(field => ({
        name: field.name || 'field',
        type: field.type || 'string',
        required: field.required !== false,
        description: field.description,
      })) : [],
      relationships: Array.isArray(model.relationships) ? model.relationships : [],
    }));
  }

  private validateServices(services: any[]): GeneratedViews['backendView']['services'] {
    return services.map(service => ({
      name: service.name || 'Service',
      description: service.description || '',
      methods: Array.isArray(service.methods) ? service.methods : [],
      dependencies: Array.isArray(service.dependencies) ? service.dependencies : [],
    }));
  }
}

// ============================================