'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export function SystemArchitecture() {
  const sources = [
    { label: 'Website URL', type: 'HTTPS' },
    { label: 'GitHub PR', type: 'Repo' },
    { label: 'ZIP Archive', type: 'Local Upload' },
    { label: 'Desktop App', type: 'Binary' },
  ];

  const outputs = [
    { label: 'Test Runs', note: 'Trace logs' },
    { label: 'Exceptions', note: 'Console errors' },
    { label: 'Visual Diffs', note: 'Screenshots' },
    { label: 'Ready Scores', note: 'Release index' },
  ];

  return (
    <div className="max-w-4xl mx-auto border border-white/5 rounded-xl bg-zinc-950/20 p-8 shadow-glass overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-center text-center font-mono">
        
        {/* Left Inputs (3 cols) */}
        <div className="md:col-span-2 space-y-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold pb-1">Target Sources</div>
          {sources.map((s, idx) => (
            <div key={idx} className="p-3 border border-white/5 bg-black/40 rounded-lg text-left">
              <div className="text-[10px] font-bold text-foreground">{s.label}</div>
              <span className="text-[8px] text-muted-foreground uppercase">{s.type}</span>
            </div>
          ))}
        </div>

        {/* Center Connection (1 col) */}
        <div className="md:col-span-1 flex items-center justify-center py-4 md:py-0">
          <div className="text-accent text-lg hidden md:block">→</div>
          <div className="text-accent text-lg block md:hidden">↓</div>
        </div>

        {/* Center Engine (1 col) */}
        <div className="md:col-span-1 border border-accent/20 bg-accent/5 p-4 rounded-xl flex flex-col items-center justify-center space-y-3 min-h-[140px]">
          <span className="animate-ping h-2.5 w-2.5 rounded-full bg-accent absolute" />
          <span className="h-3.5 w-3.5 rounded-full bg-accent relative border border-background shadow-glass" />
          <div className="text-[10px] font-bold text-accent uppercase tracking-widest">Sculra Engine</div>
          <span className="text-[7px] text-muted-foreground">V3.5 CORE</span>
        </div>

        {/* Center Connection (1 col) */}
        <div className="md:col-span-1 flex items-center justify-center py-4 md:py-0">
          <div className="text-accent text-lg hidden md:block">→</div>
          <div className="text-accent text-lg block md:hidden">↓</div>
        </div>

        {/* Right Outputs (2 cols) */}
        <div className="md:col-span-2 space-y-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold pb-1">Report Outputs</div>
          {outputs.map((o, idx) => (
            <div key={idx} className="p-3 border border-white/5 bg-black/40 rounded-lg text-left">
              <div className="text-[10px] font-bold text-foreground">{o.label}</div>
              <span className="text-[8px] text-muted-foreground">{o.note}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
