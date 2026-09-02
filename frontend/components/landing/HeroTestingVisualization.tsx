'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export function HeroTestingVisualization() {
  const [activeStep, setActiveStep] = React.useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  
  React.useEffect(() => {
    if (prefersReducedMotion) {
      setActiveStep(3); // Show final stage directly
      return;
    }
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, [prefersReducedMotion]);

  const steps = [
    { label: 'Crawl & Discover', status: 'scanning', details: 'Parsing DOM nodes: 38 inputs, 12 buttons identified.' },
    { label: 'Trigger Click Action', status: 'click', details: 'Dispatching PointerEvent on #checkout-submit-btn...' },
    { label: 'Check Layout Alignments', status: 'check', details: 'Asserting boundingClientRect offset margins: 0px drift.' },
    { label: 'Assess Build Score', status: 'done', details: 'Automated stability score verified at 94/100 (Safe to Ship).' },
  ];

  return (
    <div className="relative w-full max-w-5xl mx-auto rounded-2xl border border-zinc-200/90 bg-white shadow-xl p-4 sm:p-6 overflow-hidden transition-all duration-300">
      {/* Mock Header Menu */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-5 text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
          </div>
          <span className="ml-2 font-semibold text-zinc-800">https://app.acme.corp/checkout/billing</span>
        </div>
        
        {/* Micro-interaction callout */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-[10px] text-cyan-800 font-mono">
          <span className="font-semibold text-cyan-700">Push to main</span>
          <span className="text-cyan-400">▸</span>
          <span className="font-bold text-cyan-900">Auto-triggers test run</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-700 font-semibold">
          <span className="animate-pulse h-2 w-2 rounded-full bg-cyan-600" />
          <span>Agent Swarm: Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Control Panel / Steps (4 cols) */}
        <div className="lg:col-span-4 border border-zinc-200 rounded-xl bg-zinc-50/70 p-4 font-mono text-xs leading-relaxed flex flex-col justify-between h-auto text-zinc-700">
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-200/80">
              <span className="text-cyan-800 font-bold tracking-wider uppercase text-[10px]">Sculra Agent Swarm</span>
              <span className="text-[10px] text-zinc-500 font-medium tabular-nums">Session #4821</span>
            </div>
            
            <div className="space-y-2">
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-all duration-300 ${
                    idx === activeStep ? 'bg-white border-l-2 border-cyan-600 text-zinc-950 shadow-xs ring-1 ring-zinc-200/80' : 'text-zinc-500'
                  }`}
                >
                  <span className="mt-0.5 select-none font-bold text-cyan-700">
                    {idx < activeStep ? '✓' : idx === activeStep ? '→' : '○'}
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs">{s.label}</div>
                    {idx === activeStep && (
                      <motion.div
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[11px] text-zinc-600 mt-1 font-sans"
                      >
                        {s.details}
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-zinc-200 pt-3 mt-4 text-[10px] text-zinc-500 flex justify-between items-center tabular-nums">
            <span>DOM Node Count:</span>
            <span className="text-zinc-900 font-bold">142 elements audited</span>
          </div>
        </div>

        {/* Right Sandbox App Area (8 cols) */}
        <div className="lg:col-span-8 border border-zinc-200 rounded-xl bg-zinc-50/40 p-6 relative flex flex-col justify-between overflow-hidden min-h-[340px]">
          {/* Simulated Browser Viewport */}
          <div className="space-y-5">
            {/* Nav Bar */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded bg-zinc-950 flex items-center justify-center text-white font-bold text-xs">A</div>
                <span className="font-extrabold text-sm text-zinc-950">Acme Cloud Billing</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-zinc-600">
                <span>Invoices</span>
                <span>Payment Methods</span>
                <div className="h-6 w-6 rounded-full bg-zinc-200 border border-zinc-300 flex items-center justify-center text-[10px] font-bold text-zinc-700">JS</div>
              </div>
            </div>

            {/* Content Mock with rich real details */}
            <div className="space-y-4 relative">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-zinc-200 rounded-xl bg-white p-4 space-y-1.5 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 font-mono">Invoice Total</div>
                  <div className="text-xl font-black text-zinc-950 font-mono tabular-nums">$149.00 USD</div>
                  <div className="text-[11px] text-zinc-500 font-medium">Due in 14 days • Pro Plan</div>
                </div>
                <div className="border border-zinc-200 rounded-xl bg-white p-4 space-y-1.5 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 font-mono">Customer Account</div>
                  <div className="text-sm font-extrabold text-zinc-900 truncate">acme-corp-prod-workspace</div>
                  <div className="text-[11px] text-cyan-800 font-bold font-mono">Status: Active</div>
                </div>
              </div>

              {/* Order breakdown */}
              <div className="border border-zinc-200/80 rounded-xl bg-white p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-700 font-medium pb-1.5 border-b border-zinc-100 tabular-nums">
                  <span>Sculra Pro License (Monthly)</span>
                  <span className="font-bold text-zinc-900">$129.00</span>
                </div>
                <div className="flex justify-between text-zinc-700 font-medium tabular-nums">
                  <span>Priority Agent Runners Addon</span>
                  <span className="font-bold text-zinc-900">$20.00</span>
                </div>
              </div>

              {/* Interactive Target Element */}
              <div className="relative pt-1 flex items-center justify-between">
                <div
                  id="checkout-submit-btn"
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-zinc-950 text-white transition-all duration-300 shadow-sm ${
                    activeStep === 1 ? 'scale-105 ring-2 ring-zinc-950/30 shadow-md' : ''
                  }`}
                >
                  <span className="tabular-nums">Pay $149.00 Invoice</span>
                  <span className="text-zinc-400">→</span>
                </div>

                {/* Animated Scanning Box */}
                {activeStep === 0 && !prefersReducedMotion && (
                  <motion.div
                    initial={{ width: 0, height: 0, opacity: 0 }}
                    animate={{ width: 170, height: 44, opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse' }}
                    className="absolute -top-0.5 -left-1 border-2 border-cyan-600 rounded-lg bg-cyan-50/60 flex items-center justify-center pointer-events-none"
                  >
                    <span className="text-[10px] text-cyan-900 font-mono font-bold animate-pulse">DOM_CRAWL_INSPECT</span>
                  </motion.div>
                )}

                {/* Interactive cursor */}
                {activeStep === 1 && !prefersReducedMotion && (
                  <motion.div
                    initial={{ x: 260, y: 80 }}
                    animate={{ x: 75, y: 15 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="absolute pointer-events-none drop-shadow-lg z-20"
                  >
                    <svg className="h-6 w-6 text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.5 3v15.2l3.8-3.8 2.9 6.8 2.6-1.1-2.9-6.8 5.3-.3z" />
                    </svg>
                  </motion.div>
                )}

                {/* Visual Alignment Bounding Checks */}
                {activeStep === 2 && (
                  <div className="absolute inset-0 border-2 border-cyan-600 bg-cyan-50/50 rounded-lg flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-cyan-900 font-mono font-bold">BOUNDING_BOX_VERIFIED (0px offset)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Score Indicator */}
          <div className="border-t border-zinc-200 pt-3.5 mt-4 flex justify-between items-center">
            <span className="text-xs text-zinc-600 font-mono">Stability recommendation: <strong className="text-zinc-950 font-bold">READY TO DEPLOY</strong></span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-700">Release Score:</span>
              <span className="text-xs font-extrabold text-cyan-900 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-200 font-mono tabular-nums">94/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
