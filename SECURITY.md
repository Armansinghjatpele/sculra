# Security Vulnerability Disclosures - Sculra

Sculra takes data confidentiality, encryption compliance, and code sandboxing extremely seriously.

---

## 1. Reporting Vulnerabilities

If you discover a security flaw or secret leak, **do not file a public GitHub issue**. Instead, follow these steps:
1. Write a descriptive summary detailing the exploit vector, package versions, and steps to reproduce.
2. Email the report to `security@sculra.com`.
3. The security team will reply to confirm receipt within 48 hours.

---

## 2. Automated Scanning Policies

- **Dependabot**: Scan weekly to audit external dependencies and trigger update PRs for insecure versions.
- **Secret Scanning**: GitHub scans commits to isolate AWS, Supabase, or Stripe API keys immediately.
- **CodeQL analysis**: Static code scanning blocks PR merges if SQL injection vectors or insecure memory states are detected.
