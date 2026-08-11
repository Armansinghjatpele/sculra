# Security Policy - Sculra

Sculra takes data confidentiality, encryption compliance, tenant isolation, and code sandboxing extremely seriously.

---

## 1. Reporting Vulnerabilities

If you discover a security flaw, database leak, or secret key exposure, **do not file a public GitHub issue**. Instead, follow these steps:
1. Write a descriptive summary detailing the exploit vector, package versions, and steps to reproduce.
2. Email the report to `security@sculra.com`.
3. The security team will reply to confirm receipt within 48 hours.

---

## 2. Infrastructure Security Controls

To ensure production-grade security, we enforce the following platform standards:

- **Clerk Token Validation**: All incoming requests to our backend APIs must validate Clerk JSON Web Tokens (JWTs) using secure middlewares.
- **Supabase Row-Level Security (RLS)**: Every database table containing tenant records must define RLS rules matching user organization ownerships.
- **Secret Key Shielding**: We validate environment variables on start. Any server-only key (such as `CLERK_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`) is blocked from client-side imports, preventing runtime leaks.
- **Dependency Auditing**: GitHub Dependabot automatically audits packages weekly, raising PR alerts on deprecated or vulnerable versions.
- **CodeQL Scanning**: Static code analysis sweeps are run on pull request integrations to identify SQL injections or memory leaks.
