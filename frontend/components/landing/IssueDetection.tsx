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
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono">
          Pixel Verification Inspector
        </span>
        <button
          onClick={() => setToggleFix(!toggleFix)}
          className="px-4 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors font-mono text-xs text-zinc-900 uppercase font-extrabold cursor-pointer shadow-xs hover:border-zinc-300"
        >
          {toggleFix ? 'Simulate Bug' : 'Apply Automated Fix'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* Left: Expected UI vs Live UI Split Comparison (7 cols) */}
        <div className="md:col-span-7 border border-zinc-200/90 rounded-2xl bg-white p-5 sm:p-6 shadow-lg flex flex-col justify-between min-h-[380px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full relative">
            {/* LEFT: Figma Reference */}
            <div className="border border-zinc-200 rounded-xl bg-zinc-50/70 p-4 flex flex-col justify-between select-none">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 text-[11px] font-mono text-zinc-500 font-semibold">
                <span>Figma Target Spec</span>
                <span className="text-zinc-400">#modal-checkout</span>
              </div>
              
              <div className="space-y-3 py-3">
                <div className="text-xs font-bold text-zinc-900">Pro Plan — $49/mo</div>
                <div className="p-2.5 rounded-lg bg-white border border-zinc-200 text-[11px] space-y-1">
                  <div className="flex justify-between text-zinc-500">
                    <span>Base Tier:</span>
                    <span className="font-bold text-zinc-800">$49.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Tax (0%):</span>
                    <span className="font-bold text-zinc-800">$0.00</span>
                  </div>
                </div>
                <div className="h-9 w-full bg-zinc-950 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-xs">
                  Confirm Subscription
                </div>
              </div>

              <div className="text-[10px] font-mono text-cyan-800 font-bold bg-cyan-50/80 p-1.5 rounded text-center border border-cyan-200">
                ✓ 0px DELTA (TARGET SPEC)
              </div>
            </div>

            {/* RIGHT: Live Browser Inspector */}
            <div className="border border-zinc-200 rounded-xl bg-zinc-50/70 p-4 flex flex-col justify-between relative">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 text-[11px] font-mono text-zinc-500 font-semibold">
                <span>Live DOM Render</span>
                <span className="text-zinc-400">Viewport 390px</span>
              </div>
              
              <div className="space-y-3 py-3 relative">
                <div className="text-xs font-bold text-zinc-950">Pro Plan — $49/mo</div>
                <div className="p-2.5 rounded-lg bg-white border border-zinc-200 text-[11px] space-y-1">
                  <div className="flex justify-between text-zinc-500">
                    <span>Base Tier:</span>
                    <span className="font-bold text-zinc-800">$49.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Tax (0%):</span>
                    <span className="font-bold text-zinc-800">$0.00</span>
                  </div>
                </div>
                
                {/* Misaligned container */}
                <div
                  className={`h-9 w-full rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-500 shadow-xs ${
                    toggleFix
                      ? 'bg-zinc-950 text-white translate-y-0 translate-x-0'
                      : 'bg-red-600 text-white translate-y-2 translate-x-1.5'
                  }`}
                >
                  Confirm Subscription
                </div>

                {/* Simulated AI Exception box highlighting misalignment */}
                {!toggleFix && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 -top-1 -left-1 border-2 border-red-500 bg-red-500/10 rounded-xl flex items-center justify-center pointer-events-none z-10"
                  >
                    <div className="text-center font-mono text-[9px] text-red-700 space-y-0.5 bg-white p-2 border border-red-200 rounded-md shadow-md">
                      <div className="font-black uppercase">Bounding Shift Detected</div>
                      <div>Delta Y: +8px • Conf: 99.4%</div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className={`text-[10px] font-mono font-bold p-1.5 rounded text-center border ${
                toggleFix ? 'text-cyan-900 bg-cyan-50 border-cyan-200' : 'text-red-700 bg-red-50 border-red-200'
              }`}>
                {toggleFix ? '✓ PASSED (ALIGNMENT VERIFIED)' : '✕ CRITICAL OVERFLOW (+8px)'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Detailed Exception Diagnostic Report (5 cols) */}
        <div className="md:col-span-5 border border-zinc-200/90 rounded-2xl bg-white p-5 sm:p-6 shadow-lg space-y-4 font-mono text-xs leading-relaxed flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Diagnostic Trace</span>
              <span className="px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full font-extrabold uppercase text-[10px]">
                High Severity
              </span>
            </div>

            <div className="font-extrabold text-zinc-950 text-sm font-sans">
              Visual Collision: Subscription CTA overlaps modal container boundary
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-b border-zinc-100 py-2.5 text-zinc-600 text-[11px]">
              <div>
                <span className="text-zinc-900 font-bold block mb-0.5 font-sans">Selector:</span>
                <span className="text-zinc-700">button.checkout-cta</span>
              </div>
              <div>
                <span className="text-zinc-900 font-bold block mb-0.5 font-sans">Breakpoint:</span>
                <span className="text-zinc-700">390 × 844 (Mobile)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-zinc-900 font-bold text-[11px] block font-sans">Code Location:</span>
              <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl text-[11px] text-zinc-800 overflow-x-auto whitespace-pre font-mono">
                <span className="text-zinc-400">frontend/components/</span>CheckoutModal.tsx:L84
              </div>
            </div>
          </div>

          <div className="text-cyan-950 text-xs font-medium bg-cyan-50/80 p-3.5 border border-cyan-200 rounded-xl leading-relaxed font-sans mt-2">
            💡 <strong>Recommended Fix:</strong> Add <code className="font-mono text-[11px] font-bold text-cyan-900">margin-top: 0; padding-bottom: 1.25rem</code> to prevent bottom overflow on compact mobile screens.
          </div>
        </div>
      </div>
    </div>
  );
}
