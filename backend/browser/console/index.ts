// Console logs listeners
import { ConsoleLog } from '../types';

export class ConsoleListener {
  private logs: ConsoleLog[] = [];

  startListening(pageInstance: any): void {
    // Console log listening placeholder
  }

  getLogs(): ConsoleLog[] {
    return this.logs;
  }
}
