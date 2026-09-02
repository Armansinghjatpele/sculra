'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export function BrowserMockup() {
  const [step, setStep] = React.useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  const workflowSteps = [
    { title: '01 / CONNECT', desc: 'Point Sculra to your Target URL, GitHub Repository, or ZIP upload bundle.' },
    { title: '02 / EXPLORE', desc: 'AI agents crawl links, execute workflows, enter form fields, and click button grids.' },
    { title: '03 / UNDERSTAND', desc: 'Sculra checks console logs, layout structures, visual changes, accessibility, and speed.' },
    { title: '04 / REPORT', desc: 'Get a clean build scorecard detailing bug categories, severity, and code location recommendations.' },
  ];

  // Auto-progress loops unless user reduced motion is active
  React.useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % workflowSteps.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion, workflowSteps.length]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Workflow Step Selection Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {workflowSteps.map((ws, idx) => (
          <button
            key={idx}
            onClick={() => setStep(idx)}
            className={`p-4 border rounded-xl text-left transition-all duration-300 cursor-pointer ${
              idx === step
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-md'
                : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-700 shadow-xs'
            }`}
          >
            <div className={`text-[11px] font-mono font-bold tracking-wider ${idx === step ? 'text-cyan-400' : 'text-zinc-500'}`}>
              {ws.title}
            </div>
            <p className={`text-xs mt-2 leading-relaxed ${idx === step ? 'text-zinc-300' : 'text-zinc-600'}`}>
              {ws.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Simulated Sandbox Browser Area */}
      <div className="relative border border-zinc-200/90 rounded-2xl bg-white p-6 shadow-md min-h-[320px] flex flex-col justify-between overflow-hidden">
        {/* Browser Top */}
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 mb-4 text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
            <span className="ml-2 font-medium text-zinc-700">sculra-engine-inspect://sandbox-route</span>
          </div>

          {/* Micro-interaction callout */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-200 bg-zinc-50 text-[10px] text-zinc-800 font-mono">
            <span className="font-semibold text-zinc-600">New PR</span>
            <span className="text-zinc-400">▸</span>
            <span className="font-bold text-zinc-950">Release Readiness Score posted</span>
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
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest font-bold">Select Target Source</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Website URL', 'GitHub Repo', 'ZIP Archive', 'Desktop App'].map((target, tIdx) => (
                    <div key={tIdx} className="p-3 border border-zinc-200 rounded-xl bg-zinc-50 text-xs font-bold text-zinc-800 shadow-xs hover:border-zinc-400 transition-colors">
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
                className="w-full max-w-lg space-y-3 font-mono text-xs text-zinc-300 bg-zinc-950 p-5 border border-zinc-800 rounded-xl shadow-inner"
              >
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[10px] text-cyan-400 font-bold">
                  <span>AGENT_CRAWLER</span>
                  <span className="animate-pulse">ACTIVE</span>
                </div>
                <div className="space-y-1.5 leading-relaxed text-[11px]">
                  <div className="text-white font-medium">→ Scanning DOM: found 14 interactive inputs</div>
                  <div className="text-zinc-400">→ Filling input[type=email] values...</div>
                  <div className="text-zinc-400">→ Triggering click on form primary submit button...</div>
                  <div className="text-emerald-400 font-bold">✓ Form action successfully executed (200 OK)</div>
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
                <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/60 text-center space-y-2 shadow-xs">
                  <div className="inline-block text-[9px] text-cyan-700 bg-cyan-50 font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-cyan-200">Visual check</div>
                  <div className="text-sm font-extrabold text-zinc-900">Layout Fit</div>
                  <div className="text-2xs text-zinc-600">Checking margins, paddings, and alignment borders.</div>
                </div>
                <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/60 text-center space-y-2 shadow-xs">
                  <div className="inline-block text-[9px] text-purple-700 bg-purple-50 font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-purple-200">Performance</div>
                  <div className="text-sm font-extrabold text-zinc-900">LCP: 1.2s</div>
                  <div className="text-2xs text-zinc-600">Monitoring heavy asset payloads and script loads.</div>
                </div>
                <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/60 text-center space-y-2 shadow-xs">
                  <div className="inline-block text-[9px] text-emerald-700 bg-emerald-50 font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-200">Accessibility</div>
                  <div className="text-sm font-extrabold text-zinc-900">Contrast</div>
                  <div className="text-2xs text-zinc-600">Auditing background text color brightness offsets.</div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-md border border-zinc-200 bg-white rounded-xl p-5 space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                  <span className="text-xs font-bold text-zinc-900">Sculra Build PR Report</span>
                  <span className="text-[10px] font-mono text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">Not Ready</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 border border-zinc-100 rounded-lg bg-zinc-50">
                    <div className="text-[10px] text-zinc-500 font-medium">Release Score</div>
                    <div className="text-xl font-extrabold text-zinc-900 mt-1">83/100</div>
                  </div>
                  <div className="p-3 border border-red-100 rounded-lg bg-red-50/50">
                    <div className="text-[10px] text-red-600 font-medium">Exceptions</div>
                    <div className="text-xl font-extrabold text-red-600 mt-1">2 Critical</div>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed text-center">
                  Crawl sweep finished in 45s. Merge blocked due to visual regression exceptions.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
