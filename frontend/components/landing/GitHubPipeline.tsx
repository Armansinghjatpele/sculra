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
    { title: 'git push origin main', note: 'Developer triggers pull request build.' },
    { title: 'Deploy Sandbox Preview', note: 'Sculra deploys target container.' },
    { title: 'Run Diagnostics Swarm', note: 'Crawl DOM, check viewports, check security.' },
    { title: 'Update PR Status Check', note: 'Block merge if score is under 90%.' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Node connectors timeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative">
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
      <div className="border border-zinc-200/90 rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-cyan-700" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v5.256a2.251 2.251 0 1 0 1.5 0V5.372Zm8-.122a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v1.256a2.251 2.251 0 1 0 1.5 0V7.372ZM11.5 11.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
            </svg>
            <span className="text-xs font-bold text-zinc-950">Pull Request #42: Feature / Checkout Auth Fix</span>
          </div>
          <span className="font-mono text-[10px] text-zinc-400">Updated 2m ago</span>
        </div>

        {/* PR Status checks */}
        <div className="space-y-2.5 font-mono text-[10px]">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-600" />
              <span className="text-zinc-800 font-medium">github-actions / test-build</span>
            </div>
            <span className="text-cyan-800 font-bold">✓ Successful</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${pipelineStep === 3 ? 'bg-red-500 animate-pulse' : 'bg-cyan-600 animate-pulse'}`} />
              <span className="text-zinc-800 font-medium">sculra-qa-engine / run-verification</span>
            </div>
            <span className={pipelineStep === 3 ? 'text-red-600 font-bold' : 'text-cyan-800 font-bold'}>
              {pipelineStep === 3 ? '✕ Failed (Score: 83%)' : 'Processing checks...'}
            </span>
          </div>
        </div>

        {/* Merge Button status */}
        <div className="border-t border-zinc-100 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className={`h-2 w-2 rounded-full ${pipelineStep === 3 ? 'bg-red-500' : 'bg-cyan-600'}`} />
            <span>{pipelineStep === 3 ? '1 critical check failed' : 'Reviewing diagnostics'}</span>
          </div>
          <button
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              pipelineStep === 3
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200'
                : 'bg-zinc-950 text-white hover:bg-zinc-800 shadow-xs'
            }`}
            disabled={pipelineStep === 3}
          >
            Merge pull request
          </button>
        </div>
      </div>
    </div>
  );
}
