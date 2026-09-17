// ==============================================================================
// Sculra Worker Identity Manager (worker/src/execution/identity.ts)
// ==============================================================================

import os from 'os';
import crypto from 'crypto';
import { WorkerIdentityInfo } from './types';

/**
 * Generates an immutable, distributed-unique worker identifier.
 * Format: worker_<hostname>_<pid>_<randomHex>
 */
export function generateWorkerId(prefix: string = 'worker'): string {
  const hostname = os.hostname().replace(/[^a-zA-Z0-9_-]/g, '_');
  const pid = process.pid;
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${hostname}_${pid}_${rand}`;
}

export class WorkerIdentity {
  private static instance: WorkerIdentity | null = null;
  public readonly workerId: string;
  public readonly hostname: string;
  public readonly pid: number;
  public readonly startedAt: string;
  public readonly tags: Record<string, string>;

  constructor(customWorkerId?: string, tags: Record<string, string> = {}) {
    this.hostname = os.hostname();
    this.pid = process.pid;
    this.startedAt = new Date().toISOString();
    this.tags = tags;
    this.workerId =
      customWorkerId ||
      process.env.WORKER_ID ||
      generateWorkerId();
  }

  public static getInstance(): WorkerIdentity {
    if (!WorkerIdentity.instance) {
      WorkerIdentity.instance = new WorkerIdentity();
    }
    return WorkerIdentity.instance;
  }

  public static resetInstance(): void {
    WorkerIdentity.instance = null;
  }

  public getInfo(): WorkerIdentityInfo {
    return {
      workerId: this.workerId,
      hostname: this.hostname,
      pid: this.pid,
      startedAt: this.startedAt,
      tags: this.tags,
    };
  }
}
