'use client';

// ==============================================================================
// Sculra Decision Explorer Component (frontend/components/DecisionExplorer.tsx)
// ==============================================================================

import React, { useState, useMemo } from 'react';
import { DecisionRecord, DecisionType } from '@/lib/demoData';
import { WhyExplanationCard } from './WhyExplanationCard';
import { Search, Filter, HelpCircle, Layers } from 'lucide-react';

interface DecisionExplorerProps {
  decisions: DecisionRecord[];
  className?: string;
  emptyMessage?: string;
}

export function DecisionExplorer({
  decisions,
  className = '',
  emptyMessage = 'No autonomous decisions recorded yet.',
}: DecisionExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (selectedType !== 'ALL' && d.decisionType !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchHeadline = d.headline?.toLowerCase().includes(q);
        const matchWhy = d.why?.toLowerCase().includes(q);
        const matchTarget = d.target?.toLowerCase().includes(q);
        const matchActor = d.actorType?.toLowerCase().includes(q);
        if (!matchHeadline && !matchWhy && !matchTarget && !matchActor) {
          return false;
        }
      }
      return true;
    });
  }, [decisions, selectedType, searchQuery]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search decisions, targets, why reasons..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Decision Types</option>
            <option value="PRIORITIZATION">Prioritization</option>
            <option value="TARGET_SELECTION">Target Selection</option>
            <option value="TARGET_SKIP">Target Skip</option>
            <option value="FLAKY_QUARANTINE">Flaky Quarantine</option>
            <option value="REMEDIATION_TRIGGER">Remediation Trigger</option>
            <option value="PR_GENERATION">PR Generation</option>
            <option value="GATE_VERDICT">Gate Verdict</option>
          </select>
        </div>

        <div className="text-xs text-zinc-400 font-mono">
          {filteredDecisions.length} decision{filteredDecisions.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Decision Cards List */}
      {filteredDecisions.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-500 text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDecisions.map((decision) => (
            <WhyExplanationCard
              key={decision.id}
              decision={decision}
            />
          ))}
        </div>
      )}
    </div>
  );
}
