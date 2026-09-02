'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export function AIEngineerPanel() {
  const [terminalStep, setTerminalStep] = React.useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setTerminalStep(3); // Show all steps instantly
      return;
    }
    const timer = setInterval(() => {
      setTerminalStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, [prefersReducedMotion]);

  const stages = [
    { name: '1. Autonomous Crawler', status: 'done', desc: 'Discovered 34 routes & 142 DOM nodes' },
    { name: '2. DOM & Visual Auditor', status: 'done', desc: 'Detected +8px layout shift on 390px viewport' },
    { name: '3. Network & Console Trace', status: 'active', desc: 'Audited 18 API calls; found unhandled TypeError' },
    { name: '4. Root Cause Synthesis', status: 'pending', desc: 'Isolated CSS margin rule in AppShell.tsx:124' },
  ];

  const logs = [
    { time: '00:01:24', text: 'Thinking: Initializing autonomous crawl sweep on dashboard/settings...', type: 'info' },
    { time: '00:01:26', text: 'Investigating: Found navigation overflow exceptions in mobile viewport layout.', type: 'warn' },
    { time: '00:01:27', text: 'Analyzing context: Auditing DOM tree, console warnings, network payload streams...', type: 'info' },
    { time: '00:01:29', text: 'Issue Confirmed: Navigation items colliding with header logo on viewports < 400px.', type: 'danger' },
  ];

  return (
    <div className="w-full border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-7 shadow-lg space-y-5 font-mono text-xs leading-relaxed text-zinc-800">
      
      {/* Title Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 text-[11px]">
        <div className="flex items-center gap-2.5">
          <span className="animate-pulse h-2.5 w-2.5 rounded-full bg-cyan-600" />
          <span className="text-zinc-950 font-bold text-xs">Sculra AI QA Reasoning Engine</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-500 font-medium">
          <span>Model: Sculra-QA-Vision-v4</span>
          <span className="text-zinc-300">|</span>
          <span className="text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-mono">Agent Active</span>
        </div>
      </div>

      {/* Multi-stage Agent Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stages.map((st, sIdx) => (
          <div
            key={sIdx}
            className={`p-3 rounded-xl border transition-all ${
              sIdx <= terminalStep
                ? 'border-zinc-900 bg-zinc-50 text-zinc-950 shadow-xs'
                : 'border-zinc-200 bg-white text-zinc-400'
            }`}
          >
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span>{st.name}</span>
              <span>{sIdx < terminalStep ? '✓' : sIdx === terminalStep ? '●' : '○'}</span>
            </div>
            <div className="text-[11px] text-zinc-600 font-sans mt-1 leading-snug">
              {st.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Terminal log stream */}
      <div className="space-y-3 bg-zinc-50/80 p-4 rounded-xl border border-zinc-200 min-h-[160px]">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold pb-1 border-b border-zinc-200/60 flex justify-between">
          <span>Live Reasoning Log Stream</span>
          <span className="text-zinc-500">Auto-scrolling</span>
        </div>

        {logs.slice(0, terminalStep + 1).map((l, idx) => (
          <motion.div
            key={idx}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-start gap-3 text-xs"
          >
            <span className="text-zinc-400 select-none text-[11px]">[{l.time}]</span>
            <span
              className={
                l.type === 'warn'
                  ? 'text-amber-800 font-semibold'
                  : l.type === 'danger'
                  ? 'text-red-700 font-bold'
                  : 'text-zinc-800'
              }
            >
              {l.text}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Terminal input line indicator */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-3.5 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="animate-pulse text-cyan-800 font-bold text-sm">_</span>
          <span>Reasoning confidence index: <strong className="text-zinc-950 font-bold">99.4% certainty</strong></span>
        </div>
        <span className="text-cyan-800 font-bold">Root cause isolated</span>
      </div>

    </div>
  );
}
