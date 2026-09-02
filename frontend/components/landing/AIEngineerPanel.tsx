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

  const logs = [
    { text: 'Thinking: Initializing autonomous crawl sweep on dashboard/settings...', type: 'info' },
    { text: 'Investigating: Found navigation overflow exceptions in mobile viewport layout.', type: 'warn' },
    { text: 'Analyzing context: DOM node tree, console warning events, network requests...', type: 'info' },
    { text: 'Issue Confirmed: Navigation items colliding with header logo on viewports < 400px.', type: 'danger' },
  ];

  return (
    <div className="max-w-4xl mx-auto border border-zinc-800 rounded-2xl bg-zinc-950 p-6 shadow-xl overflow-hidden font-mono text-xs leading-relaxed text-zinc-300">
      
      {/* Title Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800 mb-4 text-zinc-400 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="animate-pulse h-2 w-2 rounded-full bg-cyan-400" />
          <span className="text-zinc-200 font-semibold">Sculra Agent reasoning logs</span>
        </div>
        <span className="text-zinc-500 font-medium">Diagnostics Agent v1.0.4</span>
      </div>

      {/* Terminal log items */}
      <div className="space-y-3.5 min-h-[160px]">
        {logs.slice(0, terminalStep + 1).map((l, idx) => (
          <motion.div
            key={idx}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-start gap-3"
          >
            <span className="text-zinc-600 select-none text-[11px]">[{new Date().toLocaleTimeString()}]</span>
            <span
              className={
                l.type === 'warn'
                  ? 'text-amber-400'
                  : l.type === 'danger'
                  ? 'text-red-400 font-bold'
                  : 'text-zinc-200'
              }
            >
              {l.text}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Terminal input line indicator */}
      <div className="flex items-center gap-2 border-t border-zinc-800/80 pt-3.5 mt-4 text-[11px] text-zinc-500">
        <span className="animate-pulse text-cyan-400 font-bold">_</span>
        <span>Reasoning summary: setting parameters check</span>
      </div>

    </div>
  );
}
