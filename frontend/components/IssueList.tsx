'use client';

import * as React from 'react';
import { SeverityBadge } from './SeverityBadge';
import { Issue } from '@/lib/demoData';
import { ChevronDown, ChevronRight, AlertTriangle, ExternalLink, Repeat } from 'lucide-react';

export function IssueList({ issues }: { issues: Issue[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-3">
      {issues.map((issue) => {
        const isExpanded = expandedId === issue.id;
        const reproSteps = issue.reproductionSteps || issue.metadata?.reproductionSteps || [];
        const occurrences = issue.occurrenceCount || 1;

        return (
          <div
            key={issue.id}
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              isExpanded
                ? 'border-cyan-500/40 bg-zinc-950/80 shadow-lg shadow-cyan-950/20'
                : 'border-border/60 bg-card/20 hover:bg-card/40 hover:border-border'
            }`}
          >
            {/* Header row */}
            <div
              onClick={() => toggleExpand(issue.id)}
              className="flex items-center justify-between p-4 cursor-pointer select-none"
            >
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={issue.severity} />
                    <span className="text-3xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                      {issue.projectName}
                    </span>
                    {occurrences > 1 && (
                      <span className="inline-flex items-center gap-1 text-3xs font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2 py-0.5 rounded-full">
                        <Repeat className="w-2.5 h-2.5" />
                        {occurrences} occurrences
                      </span>
                    )}
                    <span
                      className={`text-3xs uppercase font-mono px-2 py-0.5 rounded-full border ${
                        issue.status === 'open'
                          ? 'text-amber-400 bg-amber-950/30 border-amber-800/40'
                          : issue.status === 'resolved'
                          ? 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40'
                          : 'text-zinc-400 bg-zinc-900 border-zinc-700'
                      }`}
                    >
                      {issue.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
                    {issue.title}
                  </h3>

                  {issue.description && !isExpanded && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {issue.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right ml-4">
                <span className="text-3xs font-mono text-muted-foreground block">
                  {issue.detectedAt}
                </span>
                {issue.fingerprint && (
                  <span className="text-4xs font-mono text-zinc-500 block truncate max-w-[100px]" title={issue.fingerprint}>
                    fp:{issue.fingerprint.substring(0, 8)}
                  </span>
                )}
              </div>
            </div>

            {/* Expandable detail body */}
            {isExpanded && (
              <div className="border-t border-border/40 bg-black/40 p-5 space-y-4">
                {issue.description && (
                  <div>
                    <h4 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Summary & Description
                    </h4>
                    <p className="text-xs text-zinc-200 leading-relaxed bg-zinc-900/60 p-3 rounded-lg border border-white/5 font-sans">
                      {issue.description}
                    </p>
                  </div>
                )}

                {/* Technical details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {issue.metadata?.url && (
                    <div className="p-3 bg-zinc-900/40 rounded-lg border border-white/5">
                      <span className="text-3xs text-muted-foreground block font-mono">Affected URL</span>
                      <a
                        href={issue.metadata.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 truncate mt-0.5"
                      >
                        {issue.metadata.url}
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    </div>
                  )}

                  {issue.metadata?.selector && (
                    <div className="p-3 bg-zinc-900/40 rounded-lg border border-white/5">
                      <span className="text-3xs text-muted-foreground block font-mono">Element Selector</span>
                      <span className="text-xs font-mono text-zinc-300 truncate block mt-0.5">
                        {issue.metadata.selector}
                      </span>
                    </div>
                  )}

                  {issue.metadata?.errorSignature && (
                    <div className="p-3 bg-zinc-900/40 rounded-lg border border-white/5">
                      <span className="text-3xs text-muted-foreground block font-mono">Normalized Signature</span>
                      <span className="text-xs font-mono text-zinc-300 truncate block mt-0.5">
                        {issue.metadata.errorSignature}
                      </span>
                    </div>
                  )}
                </div>

                {/* Structured reproduction steps */}
                {reproSteps.length > 0 && (
                  <div>
                    <h4 className="text-2xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Deterministic Reproduction Steps
                    </h4>
                    <div className="space-y-2">
                      {reproSteps.map((s: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-2.5 bg-zinc-900/50 rounded-lg border border-white/5 text-xs"
                        >
                          <span className="font-mono text-3xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 shrink-0">
                            Step {s.stepNumber || idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-cyan-300 uppercase font-semibold text-3xs">
                                {s.action}
                              </span>
                              <span className="text-zinc-200 font-medium truncate">
                                {s.target}
                              </span>
                            </div>
                            <div className="text-3xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                              <span><strong>Expected:</strong> {s.expectedBehavior}</span>
                              <span className="text-amber-300/90"><strong>Observed:</strong> {s.observedBehavior}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
