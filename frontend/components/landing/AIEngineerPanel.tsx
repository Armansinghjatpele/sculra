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
    <div className="max-w-4xl mx-auto border border-white/5 rounded-xl bg-zinc-950/40 p-6 shadow-glass overflow-hidden font-mono text-[10px] leading-relaxed border-gradient-hover">
      
      {/* Title Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-accent" />
          <span>Sculra Agent reasoning logs</span>
        </div>
        <span>Diagnostics Agent v1.0.4</span>
      </div>

      {/* Terminal log items */}
      <div className="space-y-4 min-h-[160px]">
        {logs.slice(0, terminalStep + 1).map((l, idx) => (
          <motion.div
            key={idx}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-start gap-2.5"
          >
            <span className="text-muted-foreground select-none">[{new Date().toLocaleTimeString()}]</span>
            <span
              className={
                l.type === 'warn'
                  ? 'text-warning'
                  : l.type === 'danger'
                  ? 'text-danger font-bold'
                  : 'text-foreground'
              }
            >
              {l.text}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Terminal input line indicator */}
      <div className="flex items-center gap-2 border-t border-white/5 pt-3 mt-4 text-[9px] text-muted-foreground">
        <span className="animate-pulse">_</span>
        <span>Reasoning summary: setting parameters check</span>
      </div>

    </div>
  );
}
