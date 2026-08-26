'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export function IssueDetection() {
  const [toggleFix, setToggleFix] = React.useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  React.useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setToggleFix((prev) => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto items-center">
      {/* Left: Expected UI vs Current UI Visual Comparison */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Visual Bug Detection</span>
          <button
            onClick={() => setToggleFix(!toggleFix)}
            className="px-3 py-1 rounded border border-accent/20 bg-accent/5 hover:bg-accent/10 transition-colors font-mono text-[9px] text-accent uppercase font-bold cursor-pointer"
          >
            {toggleFix ? 'Show Bug' : 'Show Fix'}
          </button>
        </div>

        <div className="relative border border-white/5 rounded-xl bg-zinc-950/20 p-6 shadow-glass overflow-hidden h-80 flex flex-col justify-between border-gradient-hover">
          <div className="grid grid-cols-2 gap-4 h-full relative">
            {/* LEFT: Expected UI (Target reference) */}
            <div className="border border-white/5 rounded-lg bg-zinc-900/50 p-4 flex flex-col justify-between opacity-80 select-none">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[8px] font-mono text-muted-foreground">
                <span>Figma Reference</span>
              </div>
              <div className="space-y-3 py-4">
                <div className="h-3 w-16 bg-white/10 rounded" />
                <div className="h-5 w-full bg-accent/20 rounded flex items-center justify-center text-[9px] font-bold text-accent">
                  Pay Now
                </div>
              </div>
              <div className="text-[8px] font-mono text-green-400">✓ EXPECTED_ALIGN</div>
            </div>

            {/* RIGHT: Current Live UI (Inspected app) */}
            <div className="border border-white/5 rounded-lg bg-zinc-900/50 p-4 flex flex-col justify-between relative">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[8px] font-mono text-muted-foreground">
                <span>Live Browser Inspector</span>
              </div>
              <div className="space-y-3 py-4 relative">
                <div className="h-3 w-16 bg-white/10 rounded" />
                
                {/* Misaligned container */}
                <div
                  className={`h-5 w-full rounded flex items-center justify-center text-[9px] font-bold transition-all duration-500 ${
                    toggleFix
                      ? 'bg-accent/20 text-accent translate-y-0 translate-x-0'
                      : 'bg-danger/20 text-danger translate-y-1.5 translate-x-2'
                  }`}
                >
                  Pay Now
                </div>

                {/* Simulated AI Exception box highlighting misalignment */}
                {!toggleFix && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 -top-2 -left-2 border border-red-500 bg-red-500/5 rounded flex items-center justify-center pointer-events-none"
                  >
                    <div className="text-center font-mono text-[7px] text-danger space-y-0.5 bg-zinc-950 p-1 border border-danger/40 rounded shadow-md">
                      <div className="font-bold uppercase">Alignment Shift</div>
                      <div>Shift Y: 6px | Conf 98%</div>
                    </div>
                  </motion.div>
                )}
              </div>
              <div className={`text-[8px] font-mono ${toggleFix ? 'text-green-400' : 'text-danger'}`}>
                {toggleFix ? '✓ PASSED' : '✕ SHIFT_DETECTION'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Section 10 - From Bug to Fix (Detailed Bug Report) */}
      <div className="space-y-4">
        <span className="text-[10px] font-bold text-danger uppercase tracking-wider">Exception Details</span>
        <div className="border border-white/5 rounded-xl bg-zinc-950/40 p-6 shadow-glass space-y-4 font-mono text-[10px] leading-relaxed">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="px-1.5 py-0.5 bg-danger/10 text-danger border border-danger/20 rounded font-bold uppercase text-[8px]">
                Critical
              </span>
              <div className="font-bold text-foreground text-xs pt-1">
                Visual Collision: CTA overlapped by sidebar navbar
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-b border-white/5 py-3 text-muted-foreground text-[9px]">
            <div>
              <span className="text-foreground font-semibold block mb-0.5">Target Route:</span>
              <span>/dashboard/attendance</span>
            </div>
            <div>
              <span className="text-foreground font-semibold block mb-0.5">Device Viewport:</span>
              <span>390 × 844 (Mobile)</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-foreground font-semibold text-[9px] block">Console Trace Exception:</span>
            <div className="bg-black/50 p-3 border border-white/5 rounded text-[8px] text-red-400 overflow-x-auto whitespace-pre">
              TypeError: Cannot read properties of undefined (reading &apos;style&apos;)
              at resizeSidebar (AppShell.tsx:L124)
            </div>
          </div>

          <div className="text-accent text-[9px] font-semibold bg-accent/5 p-2.5 border border-accent/15 rounded">
            💡 Recommended Action: Set width boundaries on the dashboard layout shell sidebar wrapper component to prevent element resizing under 400px.
          </div>
        </div>
      </div>
    </div>
  );
}
