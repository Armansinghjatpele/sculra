// ==============================================================================
// Sculra Credential Provider Registry (worker/src/credentials/providers/registry.ts)
// ==============================================================================

import {
  CredentialProvider,
  CredentialType,
  ProviderDescriptor,
  IProviderValidator,
} from '../types';
import { CredentialProviderUnsupportedError } from '../errors';
import { GitHubValidator } from './validators/github-validator';
import { OpenAIValidator } from './validators/openai-validator';
import { GenericHttpValidator } from './validators/generic-http-validator';
import { WebhookValidator } from './validators/webhook-validator';

export class ProviderRegistry {
  private static descriptors: Map<CredentialProvider, ProviderDescriptor> = new Map([
    [
      'GITHUB',
      {
        provider: 'GITHUB',
        displayName: 'GitHub VCS & Developer Platform',
        supportedTypes: ['GITHUB_TOKEN', 'OAUTH_TOKEN', 'API_KEY'],
        requiredFields: ['token'],
        supportedScopes: ['READ_ONLY', 'READ_WRITE', 'ADMIN'],
        supportsRotation: true,
        supportsExpiration: true,
        workerOnlyAccess: true,
      },
    ],
    [
      'OPENAI',
      {
        provider: 'OPENAI',
        displayName: 'OpenAI AI QA & Reasoning Provider',
        supportedTypes: ['OPENAI_API_KEY', 'API_KEY'],
        requiredFields: ['apiKey'],
        supportedScopes: ['EXECUTION_ONLY'],
        supportsRotation: true,
        supportsExpiration: false,
        workerOnlyAccess: true,
      },
    ],
    [
      'GENERIC_HTTP',
      {
        provider: 'GENERIC_HTTP',
        displayName: 'Generic HTTP / API Authentication',
        supportedTypes: ['BEARER_TOKEN', 'BASIC_AUTH', 'API_KEY', 'CUSTOM_SECRET'],
        requiredFields: ['secret'],
        supportedScopes: ['READ_ONLY', 'READ_WRITE', 'EXECUTION_ONLY'],
        supportsRotation: true,
        supportsExpiration: true,
        workerOnlyAccess: true,
      },
    ],
    [
      'CI_WEBHOOK',
      {
        provider: 'CI_WEBHOOK',
        displayName: 'CI/CD Webhook Ingestion Gate',
        supportedTypes: ['WEBHOOK_SECRET'],
        requiredFields: ['secret'],
        supportedScopes: ['WEBHOOK_VERIFY'],
        supportsRotation: true,
        supportsExpiration: false,
        workerOnlyAccess: true,
      },
    ],
    [
      'PROJECT_SOURCE',
      {
        provider: 'PROJECT_SOURCE',
        displayName: 'Project Source Ingestion Credentials',
        supportedTypes: ['API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'GITHUB_TOKEN'],
        requiredFields: ['secret'],
        supportedScopes: ['READ_ONLY', 'READ_WRITE'],
        supportsRotation: true,
        supportsExpiration: true,
        workerOnlyAccess: true,
      },
    ],
    [
      'ENVIRONMENT_AUTH',
      {
        provider: 'ENVIRONMENT_AUTH',
        displayName: 'Deployment Environment Authentication',
        supportedTypes: ['BASIC_AUTH', 'BEARER_TOKEN', 'API_KEY', 'CUSTOM_SECRET'],
        requiredFields: ['secret'],
        supportedScopes: ['EXECUTION_ONLY', 'READ_ONLY'],
        supportsRotation: true,
        supportsExpiration: true,
        workerOnlyAccess: true,
      },
    ],
  ]);

  private static validators: Map<CredentialProvider, IProviderValidator> = new Map([
    ['GITHUB', new GitHubValidator()],
    ['OPENAI', new OpenAIValidator()],
    ['GENERIC_HTTP', new GenericHttpValidator()],
    ['CI_WEBHOOK', new WebhookValidator()],
    ['PROJECT_SOURCE', new GenericHttpValidator()],
    ['ENVIRONMENT_AUTH', new GenericHttpValidator()],
  ]);

  public static getDescriptor(provider: CredentialProvider): ProviderDescriptor {
    const desc = this.descriptors.get(provider);
    if (!desc) {
      throw new CredentialProviderUnsupportedError(provider);
    }
    return desc;
  }

  public static getAllDescriptors(): ProviderDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  public static getValidator(provider: CredentialProvider): IProviderValidator {
    const validator = this.validators.get(provider);
    if (!validator) {
      throw new CredentialProviderUnsupportedError(provider);
    }
    return validator;
  }

  public static isSupported(provider: string): provider is CredentialProvider {
    return this.descriptors.has(provider as CredentialProvider);
  }

  public static isTypeSupported(provider: CredentialProvider, type: CredentialType): boolean {
    const desc = this.getDescriptor(provider);
    return desc.supportedTypes.includes(type);
  }
}
