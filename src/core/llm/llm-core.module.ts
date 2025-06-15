//  LLM Core module configuration

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmCoreService } from './llm-core.service';
import { OpenAIProvider } from './providers/openai.provider';
import { GoogleGenAIProvider } from './providers/google-genai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

/**
 * Global LLM Core module that provides AI capabilities to all modules
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [LlmCoreService, OpenAIProvider, GoogleGenAIProvider, AnthropicProvider],
  exports: [LlmCoreService],
})
export class LlmCoreModule {}

// ============================================
