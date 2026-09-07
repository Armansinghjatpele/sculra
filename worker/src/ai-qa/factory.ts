// ==============================================================================
// Sculra AI QA Provider Factory (worker/src/ai-qa/factory.ts)
// ==============================================================================
// Instantiates the configured AIQAProvider (Mock or OpenAI) based on environment.

import { AIQAProvider } from './provider';
import { MockAIQAProvider } from './mock-provider';
import { OpenAIQAProvider } from './openai-provider';
import { AIQAConfig } from './types';
import { AIProviderError } from './errors';

export function createAIQAProvider(config: Partial<AIQAConfig> = {}): AIQAProvider {
  const providerName = (
    config.provider ||
    process.env.SCULRA_AI_PROVIDER ||
    process.env.AI_QA_PROVIDER ||
    'mock'
  ).toLowerCase().trim();

  switch (providerName) {
    case 'mock':
    case 'mock-deterministic':
    case 'deterministic':
      return new MockAIQAProvider();

    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new AIProviderError(
          'OPENAI_API_KEY is required when SCULRA_AI_PROVIDER is set to "openai".',
          'AI_PROVIDER_NOT_CONFIGURED',
          'openai'
        );
      }
      return new OpenAIQAProvider({
        apiKey,
        model: process.env.SCULRA_AI_MODEL,
      });
    }

    default:
      throw new AIProviderError(
        `Unsupported AI QA provider: "${providerName}". Supported providers are: "mock", "openai".`,
        'AI_PROVIDER_NOT_CONFIGURED',
        providerName
      );
  }
}
