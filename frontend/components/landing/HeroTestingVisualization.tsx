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
    { label: 'Crawl & Discover', status: 'scanning', details: 'Scanning DOM tree for interactive elements...' },
    { label: 'Trigger Click Action', status: 'click', details: 'Clicking primary checkout CTA...' },
    { label: 'Check Layout Alignments', status: 'check', details: 'Asserting layout alignment bounding boxes...' },
    { label: 'Assess Build Score', status: 'done', details: 'Report ready. Stability score indexed at 94%.' },
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-2xl border border-zinc-200/90 bg-white shadow-sm p-3 sm:p-5 overflow-hidden transition-all duration-300">
      {/* Mock Header Menu */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 mb-4 text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-200" />
          <span className="ml-2 font-medium text-zinc-700">sculra-agent-session://dashboard-v2</span>
        </div>
        
        {/* Micro-interaction callout */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-[10px] text-cyan-800 font-mono">
          <span className="font-semibold text-cyan-700">Push to main</span>
          <span className="text-cyan-400">▸</span>
          <span className="font-bold text-cyan-900">Auto-triggers test run</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-700">
          <span className="animate-pulse h-2 w-2 rounded-full bg-cyan-600" />
          <span className="font-semibold">Agent Swarm: Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Control Panel / Steps */}
        <div className="md:col-span-1 border border-zinc-200 rounded-xl bg-zinc-50/80 p-4 font-mono text-[11px] leading-relaxed flex flex-col justify-between h-64 md:h-auto text-zinc-700">
          <div className="space-y-3">
            <div className="text-cyan-800 font-bold tracking-wider uppercase text-[10px]">Sculra Agent Swarm</div>
            <div className="space-y-2">
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2 rounded-lg transition-all duration-300 ${
                    idx === activeStep ? 'bg-white border-l-2 border-cyan-600 text-zinc-950 shadow-xs' : 'text-zinc-500'
                  }`}
                >
                  <span className="mt-0.5 select-none font-bold text-cyan-700">
                    {idx < activeStep ? '✓' : idx === activeStep ? '→' : '○'}
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs">{s.label}</div>
                    {idx === activeStep && (
                      <motion.div
                        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[10px] text-zinc-600"
                      >
                        {s.details}
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-zinc-200 pt-2.5 mt-4 text-[10px] text-zinc-500 flex justify-between">
            <span>Logs:</span>
            <span className="text-zinc-900 font-semibold">23 elements scanned</span>
          </div>
        </div>

        {/* Right Sandbox App Area */}
        <div className="md:col-span-2 border border-zinc-200 rounded-xl bg-zinc-50/40 p-6 relative flex flex-col justify-between overflow-hidden h-72 md:h-96">
          {/* Simulated Browser Viewport */}
          <div className="space-y-6">
            {/* Nav Bar */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <span className="font-extrabold text-xs text-zinc-900">Acme Inc.</span>
              <div className="flex items-center gap-3 text-[11px] font-medium text-zinc-500">
                <span>Products</span>
                <span>Settings</span>
                <span className="h-5 w-5 rounded-full bg-zinc-200 border border-zinc-300" />
              </div>
            </div>

            {/* Content Mock */}
            <div className="space-y-4 relative">
              <div className="space-y-1">
                <div className="h-4 w-32 bg-zinc-200 rounded" />
                <div className="h-3 w-52 bg-zinc-100 rounded" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-zinc-200 rounded-lg bg-white p-3.5 space-y-2 shadow-xs">
                  <div className="h-3 w-16 bg-zinc-100 rounded" />
                  <div className="h-5 w-24 bg-zinc-800 rounded" />
                </div>
                <div className="border border-zinc-200 rounded-lg bg-white p-3.5 space-y-2 shadow-xs">
                  <div className="h-3 w-16 bg-zinc-100 rounded" />
                  <div className="h-5 w-24 bg-zinc-800 rounded" />
                </div>
              </div>

              {/* Interactive Target Element */}
              <div className="relative pt-2">
                <div
                  className={`inline-block px-4 py-2 rounded-md text-xs font-bold bg-zinc-950 text-white transition-all duration-300 shadow-xs ${
                    activeStep === 1 ? 'scale-105 ring-2 ring-zinc-950/20' : ''
                  }`}
                >
                  Pay Invoice
                </div>

                {/* Animated Scanning Box */}
                {activeStep === 0 && !prefersReducedMotion && (
                  <motion.div
                    initial={{ width: 0, height: 0, opacity: 0 }}
                    animate={{ width: 105, height: 40, opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse' }}
                    className="absolute -top-1 -left-1 border-2 border-cyan-600 rounded bg-cyan-50/60 flex items-center justify-center pointer-events-none"
                  >
                    <span className="text-[9px] text-cyan-800 font-mono font-bold animate-pulse">DOM_CRAWL</span>
                  </motion.div>
                )}

                {/* Interactive cursor */}
                {activeStep === 1 && !prefersReducedMotion && (
                  <motion.div
                    initial={{ x: 200, y: 100 }}
                    animate={{ x: 30, y: 15 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="absolute pointer-events-none drop-shadow-md"
                  >
                    <svg className="h-5 w-5 text-zinc-950" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.5 3v15.2l3.8-3.8 2.9 6.8 2.6-1.1-2.9-6.8 5.3-.3z" />
                    </svg>
                  </motion.div>
                )}

                {/* Visual Alignment Bounding Checks */}
                {activeStep === 2 && (
                  <div className="absolute inset-0 border-2 border-cyan-600 bg-cyan-50/50 rounded-md flex items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-cyan-800 font-mono font-bold">ALIGN_OK (0px offset)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Score Indicator */}
          <div className="border-t border-zinc-200 pt-3.5 flex justify-between items-center">
            <span className="text-[11px] text-zinc-600 font-mono">Stability recommendation: <strong className="text-zinc-900">READY</strong></span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-700">Release Score:</span>
              <span className="text-xs font-extrabold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 font-mono">94/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
