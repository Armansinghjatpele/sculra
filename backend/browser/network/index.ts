// Network traffic interceptors
import { NetworkRequest } from '../types';

export class NetworkMonitor {
  private requests: NetworkRequest[] = [];

  startMonitoring(pageInstance: any): void {
    // Monitor placeholder
  }

  getRequests(): NetworkRequest[] {
    return this.requests;
  }
}
