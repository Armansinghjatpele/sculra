import { PMAgentInput, PMAgentOutput } from './types';

export interface IPMAgent {
  generateTicket(input: PMAgentInput): Promise<PMAgentOutput>;
}

export class PMAgent implements IPMAgent {
  async generateTicket(input: PMAgentInput): Promise<PMAgentOutput> {
    return {
      ticket: {
        title: 'Mock Ticket',
        body: 'Mock description body',
        priority: 'medium',
      },
    };
  }
}
