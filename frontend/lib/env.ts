// ==============================================================================
// Sculra Environment Variables Validator (frontend/lib/env.ts)
// ==============================================================================
// Validates presence and format of required variables on startup.
// Throws a descriptive crash message if required variables are missing.

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_APP_URL',
] as const;

export function validateEnv() {
  const missing: string[] = [];

  REQUIRED_ENV_VARS.forEach((key) => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    const errorMessage = `
==============================================================================
CRITICAL INITIALIZATION ERROR: MISSING REQUIRED ENVIRONMENT VARIABLES
==============================================================================
The following required variables must be configured in your environment:
${missing.map((key) => ` - ${key}`).join('\n')}

Configure these variables inside your .env.local file.
==============================================================================
`;
    // Fail-fast by throwing a runtime exception immediately at import time
    throw new Error(errorMessage);
  }
}

// Automatically execute validation check during server initialization
if (typeof window === 'undefined') {
  validateEnv();
}
