'use client';

import * as React from 'react';

export function SystemArchitecture() {
  const sources = [
    { title: 'Website URL', sub: 'Production / Staging' },
    { title: 'GitHub Repo', sub: 'Auto-PR Webhook' },
    { title: 'ZIP Folder', sub: 'Local build upload' },
    { title: 'Desktop App', sub: 'Windows / Mac EXE' },
  ];

  const artifacts = [
    { name: 'Video Traces', status: 'Recorded (MP4)' },
    { name: 'Visual Diffs', status: 'Bounding Overflows' },
    { name: 'JUnit XML Logs', status: 'CI Compatible' },
    { name: 'Readiness Score', status: '0–100 Scale' },
  ];

  return (
    <div className="w-full border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-7 shadow-lg space-y-6">
      <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
        <span className="text-xs font-bold text-zinc-950 uppercase tracking-wider font-mono">
          Sculra Multi-Source Ingestion Engine
        </span>
        <span className="text-[10px] text-cyan-800 font-bold bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200 font-mono">
          Parallel Execution
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center font-mono text-xs">
        {/* Left Inputs (4 cols) */}
        <div className="md:col-span-4 space-y-2.5">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Input Sources</div>
          {sources.map((s, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-zinc-200 bg-zinc-50/70 flex items-center justify-between shadow-xs hover:bg-white hover:border-zinc-300 transition-all"
            >
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-900 block text-xs">{s.title}</span>
                <span className="text-[10px] text-zinc-500 font-sans">{s.sub}</span>
              </div>
              <span className="text-[10px] text-cyan-800 font-bold">READY</span>
            </div>
          ))}
        </div>

        {/* Center Processing Engine Node (3 cols) */}
        <div className="md:col-span-3 flex flex-col items-center justify-center p-4 border-2 border-zinc-950 rounded-2xl bg-zinc-50 text-center space-y-2 shadow-md relative">
          <div className="h-8 w-8 rounded-full bg-zinc-950 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            ⚡
          </div>
          <div className="font-black text-xs text-zinc-950 uppercase">Sculra Core Engine</div>
          <div className="text-[10px] text-zinc-600 font-sans">
            Crawls, asserts viewports, executes clicks & records DOM traces.
          </div>
          <div className="text-[9px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            ✓ Cluster Active
          </div>
        </div>

        {/* Right Output Artifacts (4 cols) */}
        <div className="md:col-span-4 space-y-2.5">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Generated Artifacts</div>
          {artifacts.map((a, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-zinc-200 bg-zinc-50/70 flex items-center justify-between shadow-xs hover:bg-white hover:border-zinc-300 transition-all"
            >
              <span className="font-bold text-zinc-900 text-xs">{a.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                idx === 1
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
