// Updated: LLM Provider interface definition

export interface LLMGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  model?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerationResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export interface LLMProvider {
  readonly name: string;
  readonly priority: number;

  generateText(
    prompt: string,
    options?: LLMGenerationOptions,
  ): Promise<LLMGenerationResult>;

  generateChat(
    messages: LLMMessage[],
    options?: LLMGenerationOptions,
  ): Promise<LLMGenerationResult>;

  isAvailable(): Promise<boolean>;
}

export interface LLMEmbeddingOptions {
  model?: string;
}

export interface LLMEmbeddingResult {
  embedding: number[];
  model: string;
  provider: string;
}

export interface LLMEmbeddingProvider {
  generateEmbedding(
    text: string,
    options?: LLMEmbeddingOptions,
  ): Promise<LLMEmbeddingResult>;

  generateEmbeddings(
    texts: string[],
    options?: LLMEmbeddingOptions,
  ): Promise<LLMEmbeddingResult[]>;
}

// ============================================