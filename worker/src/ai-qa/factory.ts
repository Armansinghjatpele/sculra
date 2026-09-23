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

/**
 * Creates AI QA Provider resolving API key through Credential Vault with env fallback.
 */
export async function createAIQAProviderWithVault(
  config: Partial<AIQAConfig> & { credentialId?: string },
  context?: { organizationId?: string; projectId?: string }
): Promise<AIQAProvider> {
  const providerName = (
    config.provider ||
    process.env.SCULRA_AI_PROVIDER ||
    process.env.AI_QA_PROVIDER ||
    'mock'
  ).toLowerCase().trim();

  if (providerName === 'openai') {
    let apiKey = process.env.OPENAI_API_KEY;

    if (config.credentialId) {
      const { CredentialResolver } = await import('../credentials/resolver');
      const resolution = await CredentialResolver.resolve(
        { credentialId: config.credentialId, provider: 'OPENAI', scope: 'EXECUTION_ONLY' },
        {
          actor: 'AIQAFactory',
          actorType: 'AI',
          purpose: 'AIQAInference',
          organizationId: context?.organizationId,
          projectId: context?.projectId,
        }
      );
      apiKey = resolution.secret;
    }

    if (!apiKey) {
      throw new AIProviderError(
        'OPENAI_API_KEY or valid vault credential is required when SCULRA_AI_PROVIDER is set to "openai".',
        'AI_PROVIDER_NOT_CONFIGURED',
        'openai'
      );
    }

    return new OpenAIQAProvider({
      apiKey,
      model: process.env.SCULRA_AI_MODEL,
    });
  }

  return createAIQAProvider(config);
}
