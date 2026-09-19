'use client';

// ==============================================================================
// Sculra "Why" Explanation & Decision Card (frontend/components/WhyExplanationCard.tsx)
// ==============================================================================

import React, { useState } from 'react';
import { DecisionRecord, FactCategory, ConfidenceLevel } from '@/lib/demoData';
import {
  HelpCircle,
  Clock,
  Target,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileText,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { SkipReasonBadge } from './SkipReasonBadge';

interface WhyExplanationCardProps {
  decision: DecisionRecord;
  className?: string;
  defaultExpanded?: boolean;
}

export const FACT_CATEGORY_CONFIG: Record<
  FactCategory,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  OBSERVED_FACT: {
    label: 'Observed Fact',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
    desc: 'Direct runtime observation (DOM, HTTP, logs, metrics). Verified factual.',
  },
  INFERRED_CONCLUSION: {
    label: 'Inferred Conclusion',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    desc: 'Rule-based analytical deduction derived from observed facts.',
  },
  AI_HYPOTHESIS: {
    label: 'AI Hypothesis',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    desc: 'Probabilistic AI prediction or root-cause guess. Requires verification.',
  },
  RECOMMENDATION: {
    label: 'Recommendation',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    desc: 'Suggested action or plan awaiting human or autonomous approval.',
  },
  ACTION: {
    label: 'Action',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    desc: 'Executed step dispatched by campaign or worker engine.',
  },
  ACTION_RESULT: {
    label: 'Action Result',
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
    desc: 'Direct outcome or verification result from an executed action.',
  },
  HUMAN_DECISION: {
    label: 'Human Decision',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    desc: 'Explicit human operator approval, rejection, or override.',
  },
};

export const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  { label: string; bg: string; text: string; border: string }
> = {
  HIGH: {
    label: 'High Confidence',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  MEDIUM: {
    label: 'Medium Confidence',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  LOW: {
    label: 'Low Confidence',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
  },
  INSUFFICIENT_EVIDENCE: {
    label: 'Insufficient Evidence',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
  },
};

export function WhyExplanationCard({
  decision,
  className = '',
  defaultExpanded = false,
}: WhyExplanationCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const factConfig = FACT_CATEGORY_CONFIG[decision.factCategory] || {
    label: decision.factCategory,
    bg: 'bg-zinc-800',
    text: 'text-zinc-400',
    border: 'border-zinc-700',
    desc: 'System event',
  };

  const confConfig = decision.confidence
    ? CONFIDENCE_CONFIG[decision.confidence]
    : null;

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all hover:border-zinc-700 ${className}`}
    >
      {/* Header Badges & Headline */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              title={factConfig.desc}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${factConfig.bg} ${factConfig.text} ${factConfig.border}`}
            >
              {factConfig.label}
            </span>

            {confConfig && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${confConfig.bg} ${confConfig.text} ${confConfig.border}`}
              >
                {confConfig.label}
                {decision.confidenceScore != null && (
                  <span className="ml-1 opacity-75">
                    ({Math.round(decision.confidenceScore * 100)}%)
                  </span>
                )}
              </span>
            )}

            {decision.skipReason && (
              <SkipReasonBadge reason={decision.skipReason} />
            )}

            <span className="text-xs font-mono text-zinc-500">
              {decision.actorType}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
            {decision.headline}
          </h3>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Primary "Why" */}
      <div className="mt-3 p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80">
        <div className="flex items-start gap-2 text-xs">
          <HelpCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-300">Why was this decided? </span>
            <span className="text-zinc-300/90">{decision.why}</span>
          </div>
        </div>
      </div>

      {/* Expanded Deep Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2.5 text-xs">
          {decision.whyNow && (
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-400">Why now? </span>
                <span className="text-zinc-300">{decision.whyNow}</span>
              </div>
            </div>
          )}

          {decision.target && (
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-400">Target: </span>
                <code className="font-mono text-zinc-200 bg-zinc-800/60 px-1 py-0.5 rounded">
                  {decision.target}
                </code>
              </div>
            </div>
          )}

          {decision.actionTaken && (
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-400">Action taken: </span>
                <span className="text-zinc-300">{decision.actionTaken}</span>
              </div>
            </div>
          )}

          {decision.nextAction && (
            <div className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-400">Next planned action: </span>
                <span className="text-zinc-300">{decision.nextAction}</span>
              </div>
            </div>
          )}

          {decision.alternativesConsidered && decision.alternativesConsidered.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-800/50">
              <span className="font-semibold text-zinc-400 block mb-1">
                Alternatives Evaluated & Discarded:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-400 pl-1">
                {decision.alternativesConsidered.map((alt, idx) => (
                  <li key={idx}>{alt}</li>
                ))}
              </ul>
            </div>
          )}

          {decision.policyChecks && decision.policyChecks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-800/50">
              <span className="font-semibold text-zinc-400 block mb-1.5">
                Policy Checks Evaluated:
              </span>
              <div className="space-y-1">
                {decision.policyChecks.map((check, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1.5 rounded bg-zinc-950/40 border border-zinc-800/50 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5">
                      {check.passed ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span className="font-mono text-zinc-300">{check.rule}</span>
                    </div>
                    {check.details && (
                      <span className="text-zinc-500 truncate max-w-[200px]">
                        {check.details}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {decision.evidenceIds && decision.evidenceIds.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-800/50 flex items-center gap-1 text-[11px] text-zinc-500">
              <FileText className="w-3.5 h-3.5" />
              <span>Supporting Evidence: </span>
              {decision.evidenceIds.map((ev, i) => (
                <span
                  key={i}
                  className="font-mono bg-zinc-800 px-1 py-0.5 rounded text-zinc-400 mr-1"
                >
                  {ev}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Timestamp */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Recorded {new Date(decision.createdAt).toLocaleTimeString()}</span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-400 hover:underline"
        >
          {isExpanded ? 'Show less' : 'Inspect why & policy checks'}
        </button>
      </div>
    </div>
  );
}
