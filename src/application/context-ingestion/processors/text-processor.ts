// Updated: Text processing utilities

import { Injectable, Logger } from '@nestjs/common';
import { LlmCoreService, PromptTemplate } from '@core/llm';
import { ProcessedContext } from '../interfaces/context-ingestion.interface';

@Injectable()
export class TextProcessor {
  private readonly logger = new Logger(TextProcessor.name);

  constructor(private llmService: LlmCoreService) {}

  /**
   * Process raw text input to extract structured information
   */
  async processText(
    text: string,
    options?: {
      extractUserStories?: boolean;
      analyzeComplexity?: boolean;
    },
  ): Promise<ProcessedContext> {
    const wordCount = text.split(/\s+/).length;

    // Basic preprocessing
    const cleanedText = this.preprocessText(text);

    // Extract key information using AI
    const extractionPrompt: PromptTemplate = {
      system: `You are a requirements analyst expert. Extract structured information from the given requirements text.
Focus on identifying:
- Key functional requirements
- Technical specifications
- Business rules
- Constraints
- User stories (if present)

Provide a clear, structured analysis.`,
      user: `Analyze the following requirements and extract key information:

${cleanedText}

Provide the analysis in the following JSON format:
{
  "summary": "Brief summary of the requirements",
  "keyRequirements": ["requirement1", "requirement2", ...],
  "technicalDetails": {
    "stack": ["tech1", "tech2"],
    "architecture": "description",
    "integrations": ["integration1"],
    "constraints": ["constraint1"]
  },
  "userStories": ["story1", "story2"],
  "businessRules": ["rule1", "rule2"]
}`,
    };

    try {
      const result = await this.llmService.generateFromTemplate(extractionPrompt, {
        temperature: 0.3, // Lower temperature for more consistent extraction
        maxTokens: 2000,
      });

      const extracted = this.parseAIResponse(result.content);

      // Determine complexity
      const complexity = this.analyzeComplexity(wordCount, extracted);

      return {
        summary: extracted.summary || this.generateBasicSummary(cleanedText),
        keyRequirements: extracted.keyRequirements || this.extractBasicRequirements(cleanedText),
        technicalDetails: extracted.technicalDetails || {},
        userStories: extracted.userStories,
        businessRules: extracted.businessRules,
        metadata: {
          wordCount,
          hasImages: false,
          complexity,
          confidence: this.calculateConfidence(extracted),
        },
      };
    } catch (error) {
      this.logger.error('AI extraction failed, using fallback', error);

      // Fallback to basic extraction
      return this.basicTextExtraction(cleanedText, wordCount);
    }
  }

  /**
   * Extract entities and concepts from text
   */
  async extractEntities(text: string): Promise<{
    entities: string[];
    concepts: string[];
    technologies: string[];
  }> {
    const prompt: PromptTemplate = {
      system: 'Extract entities, concepts, and technologies mentioned in the text.',
      user: `Text: ${text}

Extract and categorize:
1. Entities (users, systems, components)
2. Concepts (features, processes)
3. Technologies (languages, frameworks, tools)

Format as JSON with arrays for each category.`,
    };

    try {
      const result = await this.llmService.generateFromTemplate(prompt, {
        temperature: 0.3,
        maxTokens: 1000,
      });

      return this.parseAIResponse(result.content) || {
        entities: [],
        concepts: [],
        technologies: [],
      };
    } catch (error) {
      this.logger.error('Entity extraction failed', error);
      return {
        entities: [],
        concepts: [],
        technologies: [],
      };
    }
  }

  /**
   * Summarize long text
   */
  async summarizeText(text: string, maxLength: number = 500): Promise<string> {
    if (text.length <= maxLength) {
      return text;
    }

    const prompt: PromptTemplate = {
      system: 'You are a technical documentation expert. Create concise summaries that preserve all key technical details.',
      user: `Summarize the following text in approximately ${Math.floor(maxLength / 5)} words, focusing on key requirements and technical details:

${text}`,
    };

    try {
      const result = await this.llmService.generateFromTemplate(prompt, {
        temperature: 0.4,
        maxTokens: Math.floor(maxLength / 4), // Rough token estimate
      });

      return result.content;
    } catch (error) {
      this.logger.error('Summarization failed', error);
      return text.substring(0, maxLength) + '...';
    }
  }

  // Private helper methods

  private preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
  }

  private parseAIResponse(content: string): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (error) {
      this.logger.warn('Failed to parse AI response as JSON');
      return null;
    }
  }

  private analyzeComplexity(
    wordCount: number,
    extracted: any,
  ): 'simple' | 'moderate' | 'complex' {
    let score = 0;

    // Word count factor
    if (wordCount > 500) score += 2;
    else if (wordCount > 200) score += 1;

    // Requirements count
    const reqCount = extracted.keyRequirements?.length || 0;
    if (reqCount > 10) score += 2;
    else if (reqCount > 5) score += 1;

    // Technical complexity
    const techCount = extracted.technicalDetails?.stack?.length || 0;
    if (techCount > 5) score += 2;
    else if (techCount > 2) score += 1;

    // Integration complexity
    const integrationCount = extracted.technicalDetails?.integrations?.length || 0;
    if (integrationCount > 3) score += 2;
    else if (integrationCount > 0) score += 1;

    // Determine complexity level
    if (score >= 6) return 'complex';
    if (score >= 3) return 'moderate';
    return 'simple';
  }

  private calculateConfidence(extracted: any): number {
    let confidence = 0.5; // Base confidence

    if (extracted.summary) confidence += 0.1;
    if (extracted.keyRequirements?.length > 0) confidence += 0.2;
    if (extracted.technicalDetails?.stack?.length > 0) confidence += 0.1;
    if (extracted.userStories?.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private basicTextExtraction(text: string, wordCount: number): ProcessedContext {
    // Basic extraction without AI
    const lines = text.split('\n').filter(line => line.trim());
    const requirements = lines.filter(line =>
      line.match(/^[-*•]/) || // Bullet points
      line.match(/^\d+\./) || // Numbered lists
      line.toLowerCase().includes('must') ||
      line.toLowerCase().includes('should')
    );

    return {
      summary: this.generateBasicSummary(text),
      keyRequirements: requirements.slice(0, 10),
      technicalDetails: {
        stack: this.extractTechnologies(text),
        constraints: this.extractConstraints(text),
      },
      metadata: {
        wordCount,
        hasImages: false,
        complexity: wordCount > 300 ? 'moderate' : 'simple',
        confidence: 0.3,
      },
    };
  }

  private generateBasicSummary(text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    return sentences.slice(0, 3).join(' ').trim();
  }

  private extractBasicRequirements(text: string): string[] {
    const requirements: string[] = [];
    const patterns = [
      /(?:must|should|need to|required to)\s+([^.!?]+)/gi,
      /(?:the system|the app|the application)\s+(?:will|shall)\s+([^.!?]+)/gi,
    ];

    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        requirements.push(match[1].trim());
      }
    });

    return [...new Set(requirements)].slice(0, 10);
  }

  private extractTechnologies(text: string): string[] {
    const techKeywords = [
      'react', 'angular', 'vue', 'node', 'express', 'nestjs',
      'python', 'django', 'flask', 'java', 'spring',
      'postgresql', 'mysql', 'mongodb', 'redis',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes',
    ];

    const found: string[] = [];
    const lowerText = text.toLowerCase();

    techKeywords.forEach(tech => {
      if (lowerText.includes(tech)) {
        found.push(tech);
      }
    });

    return found;
  }

  private extractConstraints(text: string): string[] {
    const constraints: string[] = [];
    const patterns = [
      /(?:constraint|limitation|restriction):\s*([^.!?]+)/gi,
      /(?:must not|cannot|should not)\s+([^.!?]+)/gi,
    ];

    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        constraints.push(match[1].trim());
      }
    });

    return [...new Set(constraints)];
  }
}

// ============================================