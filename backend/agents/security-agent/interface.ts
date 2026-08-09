import { SecurityAgentInput, SecurityAgentOutput } from './types';

export interface ISecurityAgent {
  auditSecurity(input: SecurityAgentInput): Promise<SecurityAgentOutput>;
}

export class SecurityAgent implements ISecurityAgent {
  async auditSecurity(input: SecurityAgentInput): Promise<SecurityAgentOutput> {
    return {
      vulnerabilities: [],
    };
  }
}
