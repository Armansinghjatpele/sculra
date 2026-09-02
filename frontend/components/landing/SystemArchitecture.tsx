'use client';

import * as React from 'react';

export function SystemArchitecture() {
  const sources = [
    { label: 'Website URL', type: 'HTTPS Endpoint' },
    { label: 'GitHub PR', type: 'Repository Webhook' },
    { label: 'ZIP Archive', type: 'Local Code Upload' },
    { label: 'Desktop App', type: 'Binary Sandbox' },
  ];

  const outputs = [
    { label: 'Test Runs', note: 'Trace logs' },
    { label: 'Exceptions', note: 'Console errors' },
    { label: 'Visual Diffs', note: 'Screenshots' },
    { label: 'Ready Scores', note: 'Release index' },
  ];

  return (
    <div className="max-w-4xl mx-auto border border-zinc-200/90 rounded-2xl bg-white p-8 shadow-md overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-center text-center font-mono">
        
        {/* Left Inputs (2 cols) */}
        <div className="md:col-span-2 space-y-2.5">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold pb-1 text-left">Target Sources</div>
          {sources.map((s, idx) => (
            <div key={idx} className="p-3 border border-zinc-200 bg-zinc-50 rounded-xl text-left shadow-xs hover:border-zinc-300 transition-colors">
              <div className="text-xs font-bold text-zinc-900">{s.label}</div>
              <span className="text-[9px] text-zinc-500 uppercase font-medium">{s.type}</span>
            </div>
          ))}
        </div>

        {/* Center Connection (1 col) */}
        <div className="md:col-span-1 flex items-center justify-center py-2 md:py-0">
          <div className="text-zinc-400 text-lg hidden md:block font-bold">→</div>
          <div className="text-zinc-400 text-lg block md:hidden font-bold">↓</div>
        </div>

        {/* Center Engine (1 col) */}
        <div className="md:col-span-1 border border-zinc-900 bg-zinc-950 text-white p-4 rounded-2xl flex flex-col items-center justify-center space-y-2.5 min-h-[140px] shadow-lg">
          <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
          <div className="text-[10px] font-bold text-white uppercase tracking-widest text-center leading-tight">Sculra Engine</div>
          <span className="text-[8px] text-zinc-400 font-medium bg-zinc-900 px-1.5 py-0.5 rounded">V3.5 CORE</span>
        </div>

        {/* Center Connection (1 col) */}
        <div className="md:col-span-1 flex items-center justify-center py-2 md:py-0">
          <div className="text-zinc-400 text-lg hidden md:block font-bold">→</div>
          <div className="text-zinc-400 text-lg block md:hidden font-bold">↓</div>
        </div>

        {/* Right Outputs (2 cols) */}
        <div className="md:col-span-2 space-y-2.5">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold pb-1 text-left">Report Outputs</div>
          {outputs.map((o, idx) => (
            <div key={idx} className="p-3 border border-zinc-200 bg-zinc-50 rounded-xl text-left shadow-xs hover:border-zinc-300 transition-colors">
              <div className="text-xs font-bold text-zinc-900">{o.label}</div>
              <span className="text-[9px] text-zinc-500 font-medium">{o.note}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
