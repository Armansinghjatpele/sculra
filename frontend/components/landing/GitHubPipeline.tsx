'use client';

import * as React from 'react';

export function GitHubPipeline() {
  const [pipelineStep, setPipelineStep] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setPipelineStep((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const flow = [
    { title: 'git push origin main', note: 'Developer pushes code commit to PR branch.' },
    { title: 'Deploy Preview Sandbox', note: 'Sculra auto-spins isolated target container.' },
    { title: 'Run Diagnostics Swarm', note: 'Crawls DOM, audits viewports & security rules.' },
    { title: 'Enforce Status Gate', note: 'Blocks pull request merge if score < 90%.' },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Node connectors timeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative">
        {flow.map((f, idx) => (
          <div
            key={idx}
            className={`border rounded-xl p-4 transition-all duration-300 shadow-xs ${
              idx === pipelineStep
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-md'
                : 'border-zinc-200 bg-white text-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-mono font-bold ${idx === pipelineStep ? 'text-cyan-400' : 'text-zinc-400'}`}>
                STEP 0{idx + 1}
              </span>
              <span className="text-xs">
                {idx < pipelineStep ? '✓' : idx === pipelineStep ? '→' : '○'}
              </span>
            </div>
            <div className={`text-xs font-bold font-mono truncate ${idx === pipelineStep ? 'text-white' : 'text-zinc-900'}`}>{f.title}</div>
            <p className={`text-2xs mt-1.5 leading-relaxed ${idx === pipelineStep ? 'text-zinc-300' : 'text-zinc-600'}`}>{f.note}</p>
          </div>
        ))}
      </div>

      {/* Simulated GitHub Pull Request Status Checks Component */}
      <div className="border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-7 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-2.5">
            <svg className="h-5 w-5 text-zinc-800" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v5.256a2.251 2.251 0 1 0 1.5 0V5.372Zm8-.122a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v1.256a2.251 2.251 0 1 0 1.5 0V7.372ZM11.5 11.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
            </svg>
            <div className="space-y-0.5">
              <span className="text-xs font-extrabold text-zinc-950 block">Pull Request #42: Feature / Checkout Modal Upgrade</span>
              <span className="text-[10px] text-zinc-500 font-mono">author: @alexdev • commit: 9b4d1a • target: main</span>
            </div>
          </div>
          <span className="font-mono text-[10px] text-zinc-400">Updated 2m ago</span>
        </div>

        {/* PR Status checks with functional semantic colors */}
        <div className="space-y-3 font-mono text-xs">
          {/* Unit tests - Semantic Green */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-900 font-semibold">github-actions / test-build</span>
            </div>
            <span className="text-emerald-800 font-bold">✓ All 43 tests passing (1.2s)</span>
          </div>

          {/* Sculra QA Engine - Semantic Red/Amber */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 border border-red-200">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${pipelineStep === 3 ? 'bg-red-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-zinc-900 font-semibold">sculra-qa-engine / release-readiness</span>
            </div>
            <span className={pipelineStep === 3 ? 'text-red-700 font-bold' : 'text-amber-800 font-bold'}>
              {pipelineStep === 3 ? '✕ 2 Critical Blockers (Score: 83%)' : 'Processing agent crawl checks...'}
            </span>
          </div>
        </div>

        {/* Merge Button status */}
        <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
            <span className={`h-2 w-2 rounded-full ${pipelineStep === 3 ? 'bg-red-500' : 'bg-amber-500'}`} />
            <span>{pipelineStep === 3 ? 'Merge blocked: Quality Gate criteria not satisfied' : 'Reviewing diagnostics swarm'}</span>
          </div>
          <button
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              pipelineStep === 3
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200 font-mono'
                : 'bg-zinc-950 text-white hover:bg-zinc-800 shadow-xs font-mono'
            }`}
            disabled={pipelineStep === 3}
          >
            Merge Pull Request
          </button>
        </div>
      </div>
    </div>
  );
}
