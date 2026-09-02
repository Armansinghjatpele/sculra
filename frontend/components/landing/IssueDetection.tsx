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
          <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 uppercase tracking-wider font-mono">Visual Bug Detection</span>
          <button
            onClick={() => setToggleFix(!toggleFix)}
            className="px-3 py-1 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors font-mono text-[10px] text-zinc-800 uppercase font-bold cursor-pointer shadow-xs"
          >
            {toggleFix ? 'Show Bug' : 'Show Fix'}
          </button>
        </div>

        <div className="relative border border-zinc-200/90 rounded-2xl bg-white p-6 shadow-md overflow-hidden h-80 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-4 h-full relative">
            {/* LEFT: Expected UI (Target reference) */}
            <div className="border border-zinc-200 rounded-xl bg-zinc-50/70 p-4 flex flex-col justify-between opacity-90 select-none">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 text-[9px] font-mono text-zinc-500">
                <span>Figma Reference</span>
              </div>
              <div className="space-y-3 py-4">
                <div className="h-3 w-16 bg-zinc-300 rounded" />
                <div className="h-6 w-full bg-zinc-950 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                  Pay Now
                </div>
              </div>
              <div className="text-[9px] font-mono text-emerald-600 font-bold">✓ EXPECTED_ALIGN</div>
            </div>

            {/* RIGHT: Current Live UI (Inspected app) */}
            <div className="border border-zinc-200 rounded-xl bg-zinc-50/70 p-4 flex flex-col justify-between relative">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 text-[9px] font-mono text-zinc-500">
                <span>Live Browser Inspector</span>
              </div>
              <div className="space-y-3 py-4 relative">
                <div className="h-3 w-16 bg-zinc-300 rounded" />
                
                {/* Misaligned container */}
                <div
                  className={`h-6 w-full rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-500 shadow-xs ${
                    toggleFix
                      ? 'bg-zinc-950 text-white translate-y-0 translate-x-0'
                      : 'bg-red-600 text-white translate-y-1.5 translate-x-2'
                  }`}
                >
                  Pay Now
                </div>

                {/* Simulated AI Exception box highlighting misalignment */}
                {!toggleFix && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 -top-2 -left-2 border-2 border-red-500 bg-red-500/10 rounded-lg flex items-center justify-center pointer-events-none"
                  >
                    <div className="text-center font-mono text-[8px] text-red-700 space-y-0.5 bg-white p-1.5 border border-red-300 rounded-md shadow-md">
                      <div className="font-extrabold uppercase">Alignment Shift</div>
                      <div>Shift Y: 6px | Conf 98%</div>
                    </div>
                  </motion.div>
                )}
              </div>
              <div className={`text-[9px] font-mono font-bold ${toggleFix ? 'text-emerald-600' : 'text-red-600'}`}>
                {toggleFix ? '✓ PASSED' : '✕ SHIFT_DETECTION'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Detailed Bug Report */}
      <div className="space-y-4">
        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider font-mono">Exception Details</span>
        <div className="border border-zinc-200/90 rounded-2xl bg-white p-6 shadow-md space-y-4 font-mono text-[11px] leading-relaxed">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-extrabold uppercase text-[9px]">
                Critical
              </span>
              <div className="font-extrabold text-zinc-900 text-sm pt-1">
                Visual Collision: CTA overlapped by sidebar navbar
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-b border-zinc-100 py-3 text-zinc-600 text-[10px]">
            <div>
              <span className="text-zinc-900 font-bold block mb-0.5">Target Route:</span>
              <span>/dashboard/attendance</span>
            </div>
            <div>
              <span className="text-zinc-900 font-bold block mb-0.5">Device Viewport:</span>
              <span>390 × 844 (Mobile)</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-zinc-900 font-bold text-[10px] block">Console Trace Exception:</span>
            <div className="bg-zinc-950 p-3 rounded-lg text-[9px] text-red-400 overflow-x-auto whitespace-pre font-mono shadow-inner">
              TypeError: Cannot read properties of undefined (reading &apos;style&apos;)
              at resizeSidebar (AppShell.tsx:L124)
            </div>
          </div>

          <div className="text-cyan-900 text-[10px] font-medium bg-cyan-50/70 p-3 border border-cyan-200 rounded-xl leading-relaxed">
            💡 <strong>Recommended Action:</strong> Set width boundaries on the dashboard layout shell sidebar wrapper component to prevent element resizing under 400px.
          </div>
        </div>
      </div>
    </div>
  );
}
