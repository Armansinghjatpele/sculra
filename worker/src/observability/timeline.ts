// ==============================================================================
// Sculra Chronological Timeline Assembler (worker/src/observability/timeline.ts)
// ==============================================================================

import { AutonomousEvent, TimelineItem, FactCategory } from './types';

export class TimelineAssembler {
  /**
   * Formats raw events into chronological timeline items with visual metadata.
   */
  public static assemble(events: AutonomousEvent[]): TimelineItem[] {
    const sorted = [...events].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return sorted.map((event) => ({
      event,
      formattedTime: new Date(event.createdAt).toLocaleTimeString(),
      timeAgo: this.formatTimeAgo(event.createdAt),
      badgeColor: this.getBadgeColor(event.factCategory),
    }));
  }

  public static getBadgeColor(category: FactCategory): string {
    switch (category) {
      case 'OBSERVED_FACT':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40';
      case 'INFERRED_CONCLUSION':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40';
      case 'AI_HYPOTHESIS':
        return 'bg-purple-950/60 text-purple-300 border-purple-800/40';
      case 'RECOMMENDATION':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/40';
      case 'ACTION':
        return 'bg-blue-950/60 text-blue-300 border-blue-800/40';
      case 'ACTION_RESULT':
        return 'bg-teal-950/60 text-teal-300 border-teal-800/40';
      case 'HUMAN_DECISION':
        return 'bg-orange-950/60 text-orange-300 border-orange-800/40';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  }

  private static formatTimeAgo(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
