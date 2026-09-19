'use client';

// ==============================================================================
// Sculra Autonomous Event Timeline (frontend/components/AutonomousTimeline.tsx)
// ==============================================================================

import React, { useState, useMemo } from 'react';
import {
  AutonomousEvent,
  FactCategory,
  ActorType,
  ConfidenceLevel,
} from '@/lib/demoData';
import {
  Eye,
  Brain,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  UserCheck,
  Filter,
  Search,
  ChevronRight,
  ChevronDown,
  Clock,
  Layers,
  Shield,
  FileCode,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { FACT_CATEGORY_CONFIG, CONFIDENCE_CONFIG } from './WhyExplanationCard';
import { SkipReasonBadge } from './SkipReasonBadge';

interface AutonomousTimelineProps {
  events: AutonomousEvent[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  emptyMessage?: string;
}

export function AutonomousTimeline({
  events,
  onRefresh,
  isRefreshing = false,
  className = '',
  emptyMessage = 'No autonomous events recorded yet.',
}: AutonomousTimelineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFactCategory, setSelectedFactCategory] = useState<string>('ALL');
  const [selectedActorType, setSelectedActorType] = useState<string>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (
        selectedFactCategory !== 'ALL' &&
        e.factCategory !== selectedFactCategory
      ) {
        return false;
      }
      if (selectedActorType !== 'ALL' && e.actorType !== selectedActorType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchHeadline = e.headline?.toLowerCase().includes(q);
        const matchReason = e.reason?.toLowerCase().includes(q);
        const matchActor = e.actorType?.toLowerCase().includes(q);
        const matchType = e.eventType?.toLowerCase().includes(q);
        if (!matchHeadline && !matchReason && !matchActor && !matchType) {
          return false;
        }
      }
      return true;
    });
  }, [events, selectedFactCategory, selectedActorType, searchQuery]);

  const getEventIcon = (category: FactCategory, type: string) => {
    switch (category) {
      case 'OBSERVED_FACT':
        return <Eye className="w-4 h-4 text-cyan-400" />;
      case 'INFERRED_CONCLUSION':
        return <Brain className="w-4 h-4 text-indigo-400" />;
      case 'AI_HYPOTHESIS':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'ACTION':
        return <Play className="w-4 h-4 text-purple-400" />;
      case 'ACTION_RESULT':
        return <CheckCircle2 className="w-4 h-4 text-teal-400" />;
      case 'RECOMMENDATION':
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case 'HUMAN_DECISION':
        return <UserCheck className="w-4 h-4 text-rose-400" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Control / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, reasons, actors..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={selectedFactCategory}
            onChange={(e) => setSelectedFactCategory(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="OBSERVED_FACT">Observed Facts</option>
            <option value="INFERRED_CONCLUSION">Inferred Conclusions</option>
            <option value="AI_HYPOTHESIS">AI Hypotheses</option>
            <option value="ACTION">Actions</option>
            <option value="ACTION_RESULT">Action Results</option>
            <option value="RECOMMENDATION">Recommendations</option>
            <option value="HUMAN_DECISION">Human Decisions</option>
          </select>

          <select
            value={selectedActorType}
            onChange={(e) => setSelectedActorType(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 hidden md:block"
          >
            <option value="ALL">All Actors</option>
            <option value="CAMPAIGN_ENGINE">Campaign Engine</option>
            <option value="STRATEGY_ENGINE">Strategy Engine</option>
            <option value="EXECUTION_WORKER">Execution Worker</option>
            <option value="RCA_ENGINE">RCA Engine</option>
            <option value="REMEDIATION_AGENT">Remediation Agent</option>
            <option value="HUMAN_OPERATOR">Human Operator</option>
          </select>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-zinc-400 font-mono">
            {filteredEvents.length} event{filteredEvents.length === 1 ? '' : 's'}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
              title="Refresh timeline"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-500 text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="relative border-l-2 border-zinc-800 ml-4 pl-4 sm:ml-6 sm:pl-6 space-y-4">
          {filteredEvents.map((event) => {
            const isExpanded = expandedEventId === event.id;
            const factConfig = FACT_CATEGORY_CONFIG[event.factCategory] || {
              label: event.factCategory,
              bg: 'bg-zinc-800',
              text: 'text-zinc-400',
              border: 'border-zinc-700',
              desc: 'Event',
            };
            const confConfig = event.confidence
              ? CONFIDENCE_CONFIG[event.confidence]
              : null;

            return (
              <div key={event.id} className="relative group">
                {/* Timeline Node Icon */}
                <div className="absolute -left-[27px] sm:-left-[35px] top-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800 shadow-sm">
                  {getEventIcon(event.factCategory, event.eventType)}
                </div>

                {/* Event Card */}
                <div
                  className={`rounded-xl border p-4 transition-all ${
                    event.factCategory === 'AI_HYPOTHESIS'
                      ? 'border-amber-500/20 bg-amber-950/10 hover:border-amber-500/30'
                      : event.factCategory === 'HUMAN_DECISION'
                      ? 'border-rose-500/20 bg-rose-950/10 hover:border-rose-500/30'
                      : event.factCategory === 'RECOMMENDATION'
                      ? 'border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/30'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      {/* Badge Ribbon */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          title={factConfig.desc}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${factConfig.bg} ${factConfig.text} ${factConfig.border}`}
                        >
                          {factConfig.label}
                        </span>

                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                          {event.actorType}
                        </span>

                        {confConfig && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border ${confConfig.bg} ${confConfig.text} ${confConfig.border}`}
                          >
                            {confConfig.label}
                          </span>
                        )}

                        {event.skipReason && (
                          <SkipReasonBadge reason={event.skipReason} />
                        )}

                        <span className="text-[11px] text-zinc-500 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(event.createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Headline */}
                      <p className="text-sm font-medium text-zinc-100">
                        {event.headline}
                      </p>

                      {/* Explicit Reason */}
                      {event.reason && (
                        <p className="text-xs text-zinc-400 italic">
                          &quot;{event.reason}&quot;
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() =>
                        setExpandedEventId(isExpanded ? null : event.id)
                      }
                      className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                      aria-label="Toggle details"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded Metadata Drawer */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-zinc-500">Event ID: </span>
                          <code className="font-mono text-zinc-300">{event.id}</code>
                        </div>
                        <div>
                          <span className="text-zinc-500">Event Type: </span>
                          <code className="font-mono text-zinc-300">{event.eventType}</code>
                        </div>
                        {event.campaignId && (
                          <div>
                            <span className="text-zinc-500">Campaign: </span>
                            <code className="font-mono text-blue-400">{event.campaignId}</code>
                          </div>
                        )}
                        {event.taskId && (
                          <div>
                            <span className="text-zinc-500">Task: </span>
                            <code className="font-mono text-purple-400">{event.taskId}</code>
                          </div>
                        )}
                        {event.testRunId && (
                          <div>
                            <span className="text-zinc-500">Test Run: </span>
                            <code className="font-mono text-emerald-400">{event.testRunId}</code>
                          </div>
                        )}
                        {event.issueId && (
                          <div>
                            <span className="text-zinc-500">Issue: </span>
                            <code className="font-mono text-amber-400">{event.issueId}</code>
                          </div>
                        )}
                        {event.remediationId && (
                          <div>
                            <span className="text-zinc-500">Remediation: </span>
                            <code className="font-mono text-rose-400">{event.remediationId}</code>
                          </div>
                        )}
                      </div>

                      {event.evidenceIds && event.evidenceIds.length > 0 && (
                        <div className="pt-2 border-t border-zinc-800/50">
                          <span className="text-zinc-400 font-semibold block mb-1">
                            Associated Evidence:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {event.evidenceIds.map((evId, i) => (
                              <span
                                key={i}
                                className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] text-zinc-300"
                              >
                                {evId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="pt-2 border-t border-zinc-800/50">
                          <span className="text-zinc-400 font-semibold block mb-1">
                            Event Metadata:
                          </span>
                          <pre className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-400 overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
