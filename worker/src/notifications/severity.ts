// ==============================================================================
// Sculra Notification Severity Mapping & Urgency Policies
// (worker/src/notifications/severity.ts)
// ==============================================================================

import { NotificationUrgency } from './types';
import { SEVERITY_RANKS } from './policy';

export class NotificationSeverityHelper {
  /**
   * High and Critical events are eligible for immediate dispatch.
   */
  public static isImmediateEligible(severity: NotificationUrgency): boolean {
    return severity === 'CRITICAL' || severity === 'HIGH';
  }

  /**
   * Info and Low events prefer periodic digest or in-app view rather than active interrupts.
   */
  public static shouldPreferDigest(severity: NotificationUrgency): boolean {
    return severity === 'INFO' || severity === 'LOW';
  }

  /**
   * Maps existing issue severity strings faithfully to notification urgency.
   */
  public static mapFromRawSeverity(raw: string | null | undefined): NotificationUrgency {
    if (!raw) return 'INFO';
    const normalized = raw.toUpperCase().trim();
    switch (normalized) {
      case 'CRITICAL':
      case 'FATAL':
        return 'CRITICAL';
      case 'HIGH':
      case 'ERROR':
        return 'HIGH';
      case 'MEDIUM':
      case 'WARN':
      case 'WARNING':
        return 'MEDIUM';
      case 'LOW':
        return 'LOW';
      case 'INFO':
      default:
        return 'INFO';
    }
  }

  /**
   * Compares two urgencies. Returns > 0 if a > b, 0 if equal, < 0 if a < b.
   */
  public static compare(a: NotificationUrgency, b: NotificationUrgency): number {
    return SEVERITY_RANKS[a] - SEVERITY_RANKS[b];
  }
}
