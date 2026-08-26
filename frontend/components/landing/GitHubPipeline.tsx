'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Node connectors timeline */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {flow.map((f, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-4 bg-zinc-950/20 transition-all duration-300 ${
              idx === pipelineStep
                ? 'border-accent/40 bg-accent/5'
                : 'border-white/5'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[8px] font-mono font-bold ${idx === pipelineStep ? 'text-accent' : 'text-muted-foreground'}`}>
                STEP 0{idx + 1}
              </span>
              <span className="text-[10px]">
                {idx < pipelineStep ? '✓' : idx === pipelineStep ? '→' : '○'}
              </span>
            </div>
            <div className="text-[10px] font-semibold text-foreground font-mono truncate">{f.title}</div>
            <p className="text-4xs text-muted-foreground mt-2 leading-relaxed">{f.note}</p>
          </div>
        ))}
      </div>

      {/* Simulated GitHub Pull Request Status Checks Component */}
      <div className="border border-white/5 rounded-xl bg-zinc-950/40 p-6 shadow-glass space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-green-400" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v5.256a2.251 2.251 0 1 0 1.5 0V5.372Zm8-.122a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm0 2.122a2.25 2.25 0 1 0-1.5 0v1.256a2.251 2.251 0 1 0 1.5 0V7.372ZM11.5 11.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
            </svg>
            <span className="text-xs font-bold text-foreground">Pull Request #42: Feature / Checkout Auth Fix</span>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">Updated 2m ago</span>
        </div>

        {/* PR Status checks */}
        <div className="space-y-3 font-mono text-[9px]">
          <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-foreground">github-actions / test-build</span>
            </div>
            <span className="text-green-400">✓ Successful</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/5">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${pipelineStep === 3 ? 'bg-red-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-foreground">sculra-qa-engine / run-verification</span>
            </div>
            <span className={pipelineStep === 3 ? 'text-red-400 font-bold' : 'text-warning'}>
              {pipelineStep === 3 ? '✕ Failed (Score: 83%)' : 'Processing checks...'}
            </span>
          </div>
        </div>

        {/* Merge Button status */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-4xs text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${pipelineStep === 3 ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <span>{pipelineStep === 3 ? '1 critical check failed' : 'Reviewing diagnostics'}</span>
          </div>
          <button
            className={`px-3 py-1.5 rounded text-[10px] font-semibold transition-colors ${
              pipelineStep === 3
                ? 'bg-zinc-800 text-muted-foreground cursor-not-allowed border border-white/5'
                : 'bg-zinc-900 border border-white/10 text-foreground hover:bg-zinc-800'
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
