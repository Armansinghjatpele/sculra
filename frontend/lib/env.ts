// ==============================================================================
// Sculra Environment Variables Validator (frontend/lib/env.ts)
// ==============================================================================
// Validates environment variables on startup.
// 1. Fails-fast by throwing a runtime exception if REQUIRED variables are missing.
// 2. Logs clear console alerts if OPTIONAL parameters are omitted.
// 3. Protects server-only secrets from client bundle inclusion.

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const OPTIONAL_ENV_VARS = [
  'CLERK_WEBHOOK_SECRET',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_AI_API_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
] as const;

export function validateEnv() {
  const isServer = typeof window === 'undefined';

  // 1. Client-side leak protection (Check if server secrets entered the browser bundle)
  if (!isServer) {
    const leakedSecrets: string[] = [];
    const clientSideKeys = Object.keys(process.env);
    
    clientSideKeys.forEach((key) => {
      if (
        !key.startsWith('NEXT_PUBLIC_') &&
        key !== 'NODE_ENV' &&
        key !== 'SUB_CANISTER' && // system keys
        process.env[key]
      ) {
        leakedSecrets.push(key);
      }
    });

    if (leakedSecrets.length > 0) {
      console.error(
        `[SECURITY WARNING]: Server secrets leaked to the browser! Leaked keys: ${leakedSecrets.join(', ')}`
      );
    }
    return;
  }

  // 2. Server-side required checks (Fail-fast)
  const missingRequired: string[] = [];
  REQUIRED_ENV_VARS.forEach((key) => {
    if (!process.env[key]) {
      missingRequired.push(key);
    }
  });

  if (missingRequired.length > 0) {
    const errorMsg = `
==============================================================================
CRITICAL INITIALIZATION ERROR: MISSING REQUIRED ENVIRONMENT VARIABLES
==============================================================================
The following required variables must be configured to run Sculra:
${missingRequired.map((key) => ` - ${key}`).join('\n')}

Configure these variables inside your local .env.local file.
==============================================================================
`;
    throw new Error(errorMsg);
  }

  // 3. Server-side optional checks (Warn only)
  const missingOptional: string[] = [];
  OPTIONAL_ENV_VARS.forEach((key) => {
    if (!process.env[key]) {
      missingOptional.push(key);
    }
  });

  if (missingOptional.length > 0 && process.env.NODE_ENV === 'development') {
    console.log(
      `[Sculra Dev Info]: The following optional integration features are disabled because their keys are missing:\n${missingOptional.map((k) => ` - ${k}`).join('\n')}\n`
    );
  }
}

// Automatically execute validation check during server initialization
if (typeof window === 'undefined') {
  validateEnv();
}
