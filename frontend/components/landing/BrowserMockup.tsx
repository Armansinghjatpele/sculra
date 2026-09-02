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
            className={`p-5 border rounded-2xl text-left transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[125px] ${
              idx === step
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-lg ring-1 ring-zinc-950'
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
      <div className="relative border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-8 shadow-lg min-h-[420px] flex flex-col justify-between overflow-hidden">
        {/* Browser Top Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-6 text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
            </div>
            <span className="ml-2 font-semibold text-zinc-800">sculra-engine-inspect://target-sandbox-staging</span>
          </div>

          {/* Micro-interaction callout */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-[10px] text-cyan-800 font-mono">
            <span className="font-semibold text-cyan-700">New PR</span>
            <span className="text-cyan-400">▸</span>
            <span className="font-bold text-cyan-900">Release Readiness Score posted</span>
          </div>
        </div>

        {/* Content wrapper with smooth transition */}
        <div className="flex-1 flex items-center justify-center py-2 w-full">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-3xl text-center space-y-6"
              >
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Step 01 / Target Configuration</div>
                  <h4 className="text-lg font-black text-zinc-950">Connect your target repository or deployed URL</h4>
                  <p className="text-xs text-zinc-600 max-w-lg mx-auto">Sculra spins up isolated browser sandboxes to crawl your live code or preview environments.</p>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  {[
                    { label: 'Website URL', sub: 'Production / Staging' },
                    { label: 'GitHub Repo', sub: 'Automated PR Webhook' },
                    { label: 'ZIP Archive', sub: 'Local build upload' },
                    { label: 'Desktop App', sub: 'Native binary test' },
                  ].map((target, tIdx) => (
                    <div
                      key={tIdx}
                      className={`p-4 border rounded-xl text-center space-y-1.5 transition-all ${
                        tIdx === 1
                          ? 'border-2 border-zinc-950 bg-white shadow-md'
                          : 'border-zinc-200 bg-zinc-50/60 hover:bg-white shadow-xs'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-zinc-950">{target.label}</div>
                      <div className="text-[11px] text-zinc-500 font-sans">{target.sub}</div>
                      {tIdx === 1 && (
                        <div className="inline-block text-[9px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded font-mono border border-cyan-200">
                          Selected
                        </div>
                      )}
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
                className="w-full max-w-3xl space-y-4 font-mono text-xs text-zinc-800 bg-zinc-50/90 p-6 border border-zinc-200 rounded-2xl shadow-inner"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 pb-3 text-xs text-cyan-800 font-bold">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-600 animate-ping" />
                    <span>AGENT_CRAWLER_SWARM — 4 WORKERS</span>
                  </span>
                  <span className="bg-cyan-100 text-cyan-900 px-2.5 py-0.5 rounded-full text-[10px]">SCANNING ACTIVE</span>
                </div>
                <div className="space-y-2.5 leading-relaxed text-xs">
                  <div className="text-zinc-950 font-semibold flex items-center gap-2">
                    <span className="text-cyan-700">▸</span>
                    <span>Discovered 34 routes and 142 interactable DOM nodes</span>
                  </div>
                  <div className="text-zinc-600 flex items-center gap-2">
                    <span className="text-zinc-400">▸</span>
                    <span>Injecting form payloads into [type=email], [type=password], select[name=role]</span>
                  </div>
                  <div className="text-zinc-600 flex items-center gap-2">
                    <span className="text-zinc-400">▸</span>
                    <span>Executing multi-step checkout workflow with mock credit card tokens</span>
                  </div>
                  <div className="text-cyan-900 font-bold bg-cyan-50 p-3 rounded-xl border border-cyan-200 flex items-center justify-between">
                    <span>✓ Workflow &quot;Enterprise Signup Flow&quot; executed (200 OK — 480ms)</span>
                    <span className="text-[10px] text-cyan-700">0 unhandled exceptions</span>
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
                className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl"
              >
                <div className="p-6 border border-zinc-200 rounded-2xl bg-white text-center space-y-3 shadow-xs">
                  <div className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 uppercase tracking-wider px-2.5 py-1 rounded-full border border-cyan-200 font-mono">
                    Visual Layout
                  </div>
                  <div className="text-lg font-black text-zinc-950">Layout Bounding</div>
                  <div className="text-xs text-zinc-600 leading-relaxed font-sans">
                    Asserts exact pixel offsets, z-index stack collisions, and overflowing container boundaries.
                  </div>
                  <div className="text-[11px] font-mono text-zinc-900 font-bold pt-2 border-t border-zinc-100">
                    42 checks passed
                  </div>
                </div>

                <div className="p-6 border border-zinc-200 rounded-2xl bg-white text-center space-y-3 shadow-xs">
                  <div className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 uppercase tracking-wider px-2.5 py-1 rounded-full border border-cyan-200 font-mono">
                    Performance
                  </div>
                  <div className="text-lg font-black text-zinc-950">LCP 1.1s • CLS 0.01</div>
                  <div className="text-xs text-zinc-600 leading-relaxed font-sans">
                    Monitors heavy asset payloads, uncompressed images, script execution blocks, and layout shifts.
                  </div>
                  <div className="text-[11px] font-mono text-zinc-900 font-bold pt-2 border-t border-zinc-100">
                    Lighthouse: 98/100
                  </div>
                </div>

                <div className="p-6 border border-zinc-200 rounded-2xl bg-white text-center space-y-3 shadow-xs">
                  <div className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 uppercase tracking-wider px-2.5 py-1 rounded-full border border-cyan-200 font-mono">
                    Accessibility
                  </div>
                  <div className="text-lg font-black text-zinc-950">WCAG 2.1 AA</div>
                  <div className="text-xs text-zinc-600 leading-relaxed font-sans">
                    Audits contrast ratios, missing ARIA tags, keyboard focus rings, and screen reader labels.
                  </div>
                  <div className="text-[11px] font-mono text-zinc-900 font-bold pt-2 border-t border-zinc-100">
                    Compliance: 96%
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="report"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-xl border border-zinc-200 bg-white rounded-2xl p-6 sm:p-7 space-y-5 shadow-md"
              >
                <div className="flex justify-between items-center pb-3.5 border-b border-zinc-100">
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-zinc-950 block">Sculra Build Release Report</span>
                    <span className="text-[11px] text-zinc-500 font-mono">Branch: feature/checkout-v2 • Commit 9b4d1a</span>
                  </div>
                  <span className="text-[10px] font-mono text-red-700 font-bold bg-red-50 px-3 py-1 rounded-full border border-red-200">
                    2 Critical Exceptions
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50">
                    <div className="text-[11px] text-zinc-500 font-bold font-mono uppercase">Release Score</div>
                    <div className="text-3xl font-black text-zinc-950 mt-1 font-mono">83/100</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Threshold: 90/100</div>
                  </div>
                  <div className="p-4 border border-red-200 rounded-xl bg-red-50/50">
                    <div className="text-[11px] text-red-700 font-bold font-mono uppercase">Exceptions</div>
                    <div className="text-3xl font-black text-red-700 mt-1 font-mono">2 Blockers</div>
                    <div className="text-[10px] text-red-600 mt-0.5">Mobile Overflow + TypeError</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 font-sans leading-relaxed">
                  <strong>Action Required:</strong> Pull request merge is blocked by Sculra Quality Gate. Resolve visual collision in <code className="text-zinc-950 font-bold font-mono text-[11px]">/dashboard/attendance</code> before deployment.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
