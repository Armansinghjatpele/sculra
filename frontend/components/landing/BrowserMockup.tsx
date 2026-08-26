'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function BrowserMockup() {
  const [step, setStep] = React.useState(0);

  const workflowSteps = [
    { title: '01 / CONNECT', desc: 'Point Sculra to your Target URL, GitHub Repository, or ZIP upload bundle.' },
    { title: '02 / EXPLORE', desc: 'AI agents crawl links, execute workflows, enter form fields, and click button grids.' },
    { title: '03 / UNDERSTAND', desc: 'Sculra checks console logs, layout structures, visual changes, accessibility, and speed.' },
    { title: '04 / REPORT', desc: 'Get a clean build scorecard detailing bug categories, severity, and code location recommendations.' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {/* Workflow Step Selection Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {workflowSteps.map((ws, idx) => (
          <button
            key={idx}
            onClick={() => setStep(idx)}
            className={`p-4 border rounded-lg text-left transition-all duration-300 ${
              idx === step
                ? 'border-accent/40 bg-accent/5'
                : 'border-white/5 bg-zinc-950/20 hover:border-white/10'
            }`}
          >
            <div className={`text-[10px] font-mono font-bold tracking-wider ${idx === step ? 'text-accent' : 'text-muted-foreground'}`}>
              {ws.title}
            </div>
            <p className="text-4xs text-muted-foreground mt-2 leading-relaxed">
              {ws.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Simulated Sandbox Browser Area */}
      <div className="relative border border-white/8 rounded-xl bg-zinc-950/40 p-6 shadow-glass backdrop-blur-md min-h-[300px] flex flex-col justify-between overflow-hidden">
        {/* Browser Top */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500/60" />
            <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
            <span className="h-2 w-2 rounded-full bg-green-500/60" />
            <span className="ml-2">sculra-engine-inspect://sandbox-route</span>
          </div>

          {/* Micro-interaction callout */}
          <div className="hidden sm:flex items-center gap-2 px-2 py-0.5 rounded border border-accent/20 bg-accent/5 text-[9px] text-accent">
            <span>New PR</span>
            <span className="text-muted-foreground">▸</span>
            <span className="font-semibold">Release Readiness Score posted</span>
          </div>
        </div>

        {/* Content wrapper with transition */}
        <div className="flex-1 py-4 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-md text-center space-y-4"
              >
                <div className="text-[10px] font-mono text-accent uppercase tracking-widest">Select Target Source</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Website URL', 'GitHub Repo', 'ZIP Archive', 'Desktop App'].map((target, tIdx) => (
                    <div key={tIdx} className="p-3 border border-white/5 rounded bg-black/40 text-[10px] font-semibold text-foreground">
                      {target}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="explore"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-lg space-y-4 font-mono text-[10px] text-muted-foreground bg-black/40 p-4 border border-white/5 rounded"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[9px] text-accent">
                  <span>AGENT_CRAWLER</span>
                  <span>ACTIVE</span>
                </div>
                <div className="space-y-1.5 leading-relaxed">
                  <div className="text-foreground">→ Scanning DOM: found 14 interactive inputs</div>
                  <div>→ Filling input[type=email] values...</div>
                  <div>→ Triggering click on form primary submit button...</div>
                  <div className="text-green-400">✓ Form action successfully executed (200 OK)</div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="understand"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl"
              >
                <div className="p-4 border border-white/5 rounded bg-black/40 text-center space-y-2">
                  <div className="text-[9px] text-accent font-bold uppercase tracking-wider">Visual check</div>
                  <div className="text-xs font-semibold text-foreground">Layout Fit</div>
                  <div className="text-4xs text-muted-foreground">Checking margins, paddings, and alignment borders.</div>
                </div>
                <div className="p-4 border border-white/5 rounded bg-black/40 text-center space-y-2">
                  <div className="text-[9px] text-accent font-bold uppercase tracking-wider">Performance</div>
                  <div className="text-xs font-semibold text-foreground">LCP: 1.2s</div>
                  <div className="text-4xs text-muted-foreground">Monitoring heavy asset payloads and script loads.</div>
                </div>
                <div className="p-4 border border-white/5 rounded bg-black/40 text-center space-y-2">
                  <div className="text-[9px] text-accent font-bold uppercase tracking-wider">Accessibility</div>
                  <div className="text-xs font-semibold text-foreground">Contrast</div>
                  <div className="text-4xs text-muted-foreground">Auditing background text color brightness offsets.</div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-md border border-white/5 bg-zinc-950/80 rounded-lg p-5 space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-xs font-bold text-foreground">Sculra Build QA Report</span>
                  <span className="text-[10px] font-mono text-danger font-semibold bg-danger/10 px-2 py-0.5 rounded">Not Ready</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 border border-white/5 rounded bg-black/20">
                    <div className="text-[10px] text-muted-foreground">Release Score</div>
                    <div className="text-xl font-bold text-foreground mt-1">83/100</div>
                  </div>
                  <div className="p-3 border border-white/5 rounded bg-black/20">
                    <div className="text-[10px] text-muted-foreground">Exceptions</div>
                    <div className="text-xl font-bold text-danger mt-1">2 Critical</div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
                  4 layout anomalies must be resolved before merging the target PR.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="border-t border-white/5 pt-3 mt-4 text-[9px] text-muted-foreground text-center font-mono uppercase tracking-wider">
          Sculra runs autonomously from the outside in without code hooks.
        </div>
      </div>
    </div>
  );
}
