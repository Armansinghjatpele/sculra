// ==============================================================================
// Sculra Logging Module (backend/logger/index.ts)
// ==============================================================================
// Provides a unified interface for Application logs, Error logs,
// Audit logs, and Performance monitoring metrics.

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  message: string;
  context?: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private static formatLog(level: LogLevel, payload: LogPayload): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: payload.message,
      context: payload.context || 'GLOBAL',
      metadata: payload.metadata || {},
    });
  }

  /**
   * General application logs
   */
  public static info(message: string, context?: string, metadata?: Record<string, any>) {
    console.log(this.formatLog('info', { message, context, metadata }));
  }

  /**
   * Debugging utility logs
   */
  public static debug(message: string, context?: string, metadata?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatLog('debug', { message, context, metadata }));
    }
  }

  /**
   * Error logs with captured stacktraces
   */
  public static error(message: string, error?: Error, context?: string, metadata?: Record<string, any>) {
    const errorMeta = error ? { ...metadata, errorName: error.name, errorMessage: error.message, stack: error.stack } : metadata;
    console.error(this.formatLog('error', { message, context, metadata: errorMeta }));
  }

  /**
   * Security audit logs (write-once audit trailing)
   */
  public static audit(action: string, actorId: string, resource: string, details?: Record<string, any>) {
    console.log(this.formatLog('info', {
      message: `AUDIT: [${action}] by User ${actorId} on Resource ${resource}`,
      context: 'AUDIT_LOG',
      metadata: { action, actorId, resource, details },
    }));
  }

  /**
   * Performance monitoring logs (duration / memory metric captures)
   */
  public static performance(operation: string, durationMs: number, details?: Record<string, any>) {
    console.log(this.formatLog('info', {
      message: `PERFORMANCE: [${operation}] took ${durationMs}ms`,
      context: 'PERF_MONITOR',
      metadata: { operation, durationMs, details },
    }));
  }
}

