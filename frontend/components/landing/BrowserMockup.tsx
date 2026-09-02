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
    { title: '04 / REPORT', desc: 'Get a clean build scorecard detailing bug categories, severity, and code recommendations.' },
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
    <div className="w-full space-y-6">
      {/* Workflow Step Selection Grid - Balanced 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {workflowSteps.map((ws, idx) => (
          <button
            key={idx}
            onClick={() => setStep(idx)}
            className={`p-5 border rounded-2xl text-left transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[120px] ${
              idx === step
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-md ring-1 ring-zinc-950'
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

      {/* Simulated Sandbox Browser Area - Balanced, wide, no dead space */}
      <div className="relative border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-8 shadow-sm min-h-[380px] flex flex-col justify-between overflow-hidden">
        {/* Browser Top Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-6 text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
            </div>
            <span className="ml-2 font-medium text-zinc-700">sculra-engine-inspect://sandbox-route</span>
          </div>

          {/* Micro-interaction callout */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-[10px] text-cyan-800 font-mono">
            <span className="font-semibold text-cyan-700">New PR</span>
            <span className="text-cyan-400">▸</span>
            <span className="font-bold text-cyan-900">Release Readiness Score posted</span>
          </div>
        </div>

        {/* Content wrapper with smooth transition */}
        <div className="flex-1 flex items-center justify-center py-4 w-full">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-2xl text-center space-y-6"
              >
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Step 01 / Select Target Source</div>
                  <h4 className="text-base font-extrabold text-zinc-950">Where should Sculra run tests?</h4>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Website URL', sub: 'Production or Staging' },
                    { label: 'GitHub Repo', sub: 'Automated PR Webhooks' },
                    { label: 'ZIP Archive', sub: 'Local build upload' },
                    { label: 'Desktop App', sub: 'Native binary build' },
                  ].map((target, tIdx) => (
                    <div
                      key={tIdx}
                      className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/60 hover:bg-white text-center space-y-1 shadow-xs hover:border-zinc-400 hover:shadow-sm transition-all"
                    >
                      <div className="text-xs font-bold text-zinc-900">{target.label}</div>
                      <div className="text-[10px] text-zinc-500 font-sans">{target.sub}</div>
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
                className="w-full max-w-2xl space-y-4 font-mono text-xs text-zinc-800 bg-zinc-50 p-6 border border-zinc-200 rounded-xl shadow-inner"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5 text-[11px] text-cyan-800 font-bold">
                  <span>AGENT_CRAWLER_SWARM</span>
                  <span className="animate-pulse bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded">ACTIVE</span>
                </div>
                <div className="space-y-2 leading-relaxed text-xs">
                  <div className="text-zinc-950 font-semibold">→ Scanning DOM tree: found 14 interactive inputs and 6 route anchors</div>
                  <div className="text-zinc-600">→ Filling input[type=email] with sanitized test fixture payload...</div>
                  <div className="text-zinc-600">→ Triggering click on form primary submit button...</div>
                  <div className="text-cyan-800 font-bold bg-cyan-50/70 p-2 rounded border border-cyan-200">
                    ✓ Form action successfully executed without unhandled promise rejections (200 OK)
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="understand"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl"
              >
                <div className="p-5 border border-zinc-200 rounded-xl bg-zinc-50/60 text-center space-y-2 shadow-xs">
                  <div className="inline-block text-[10px] text-cyan-800 bg-cyan-50 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border border-cyan-200 font-mono">
                    Visual check
                  </div>
                  <div className="text-base font-extrabold text-zinc-950">Layout Fit</div>
                  <div className="text-xs text-zinc-600 leading-relaxed">Checking margins, paddings, and alignment borders.</div>
                </div>
                <div className="p-5 border border-zinc-200 rounded-xl bg-zinc-50/60 text-center space-y-2 shadow-xs">
                  <div className="inline-block text-[10px] text-cyan-800 bg-cyan-50 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border border-cyan-200 font-mono">
                    Performance
                  </div>
                  <div className="text-base font-extrabold text-zinc-950">LCP: 1.2s</div>
                  <div className="text-xs text-zinc-600 leading-relaxed">Monitoring asset payloads, DOM nodes, and script execution.</div>
                </div>
                <div className="p-5 border border-zinc-200 rounded-xl bg-zinc-50/60 text-center space-y-2 shadow-xs">
                  <div className="inline-block text-[10px] text-cyan-800 bg-cyan-50 font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border border-cyan-200 font-mono">
                    Accessibility
                  </div>
                  <div className="text-base font-extrabold text-zinc-950">Contrast Check</div>
                  <div className="text-xs text-zinc-600 leading-relaxed">Auditing WCAG 2.1 AA background contrast brightness offsets.</div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-lg border border-zinc-200 bg-white rounded-2xl p-6 space-y-5 shadow-sm"
              >
                <div className="flex justify-between items-center pb-3 border-b border-zinc-100">
                  <span className="text-xs font-extrabold text-zinc-950">Sculra Build PR Report</span>
                  {/* Single allowed red for genuine error state */}
                  <span className="text-[10px] font-mono text-red-700 font-bold bg-red-50 px-2.5 py-0.5 rounded border border-red-200">
                    2 Critical Exceptions
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50">
                    <div className="text-[11px] text-zinc-500 font-medium font-mono">Release Score</div>
                    <div className="text-2xl font-black text-zinc-950 mt-1 font-mono">83/100</div>
                  </div>
                  <div className="p-4 border border-red-200 rounded-xl bg-red-50/40">
                    <div className="text-[11px] text-red-700 font-medium font-mono">Exceptions</div>
                    <div className="text-2xl font-black text-red-700 mt-1 font-mono">2 Blockers</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed text-center">
                  Crawl sweep completed across 48 routes in 45s. Pull request merge blocked due to visual regression exceptions.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
