export interface SecurityAgentInput {
  targetUrl: string;
  responseHeaders: Record<string, string>;
  cookieDirectives: string[];
}

export interface SecurityAgentOutput {
  vulnerabilities: {
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    cve?: string;
    description: string;
    remediation: string;
  }[];
}
