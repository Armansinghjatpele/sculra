'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export function HeroTestingVisualization() {
  const [activeStep, setActiveStep] = React.useState(0);
  
  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { label: 'Crawl and Discover', status: 'scanning', details: 'Scanning DOM tree for interactive elements...' },
    { label: 'Trigger Click Action', status: 'click', details: 'Clicking primary checkout CTA...' },
    { label: 'Check Layout Alignments', status: 'check', details: 'Asserting layout alignment bounding boxes...' },
    { label: 'Assess Build Score', status: 'done', details: 'Report ready. Stability score indexed at 94%.' },
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-xl border border-white/8 bg-zinc-950/45 shadow-glass backdrop-blur-md p-4 overflow-hidden">
      {/* Mock Header Menu */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4 text-[10px] text-muted-foreground font-mono">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500/60" />
          <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
          <span className="h-2 w-2 rounded-full bg-green-500/60" />
          <span className="ml-2">sculra-agent-session://dashboard-v2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-accent" />
          <span>Agent Swarm: Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Control Panel / Terminal */}
        <div className="md:col-span-1 border border-white/5 rounded-lg bg-black/40 p-4 font-mono text-[11px] leading-relaxed flex flex-col justify-between h-64 md:h-auto">
          <div className="space-y-3">
            <div className="text-accent font-semibold tracking-wider uppercase text-[9px]">Sculra Agent Swarm</div>
            <div className="space-y-2">
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-1.5 rounded transition-all duration-300 ${
                    idx === activeStep ? 'bg-zinc-900 border-l-2 border-accent text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="mt-0.5 select-none">
                    {idx < activeStep ? '✓' : idx === activeStep ? '→' : '○'}
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-2xs">{s.label}</div>
                    {idx === activeStep && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[10px] text-muted-foreground"
                      >
                        {s.details}
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/5 pt-2 mt-4 text-[10px] text-muted-foreground">
            Logs: <span className="text-foreground">23 elements scanned</span>
          </div>
        </div>

        {/* Right Sandbox App Area */}
        <div className="md:col-span-2 border border-white/5 rounded-lg bg-zinc-900/50 p-6 relative flex flex-col justify-between overflow-hidden h-72 md:h-96">
          {/* Simulated Browser Viewport */}
          <div className="space-y-6">
            {/* Nav Bar */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="font-bold text-xs">Acme Inc.</span>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Products</span>
                <span>Settings</span>
                <span className="h-5 w-5 rounded-full bg-zinc-800 border border-white/10" />
              </div>
            </div>

            {/* Content Mock */}
            <div className="space-y-4 relative">
              <div className="space-y-1">
                <div className="h-4 w-28 bg-white/10 rounded" />
                <div className="h-3 w-48 bg-white/5 rounded" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-white/5 rounded p-3 space-y-2">
                  <div className="h-3 w-12 bg-white/10 rounded" />
                  <div className="h-5 w-20 bg-white/5 rounded" />
                </div>
                <div className="border border-white/5 rounded p-3 space-y-2">
                  <div className="h-3 w-12 bg-white/10 rounded" />
                  <div className="h-5 w-20 bg-white/5 rounded" />
                </div>
              </div>

              {/* Interactive Target Element */}
              <div className="relative pt-2">
                <div
                  className={`inline-block px-4 py-2 rounded text-xs font-semibold bg-accent text-background transition-all duration-300 ${
                    activeStep === 1 ? 'scale-105 ring-2 ring-accent/50' : ''
                  }`}
                >
                  Pay Invoice
                </div>

                {/* Animated Scanning Box */}
                {activeStep === 0 && (
                  <motion.div
                    initial={{ width: 0, height: 0, opacity: 0 }}
                    animate={{ width: 100, height: 40, opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse' }}
                    className="absolute -top-1 -left-1 border border-accent rounded bg-accent/5 flex items-center justify-center pointer-events-none"
                  >
                    <span className="text-[8px] text-accent font-mono animate-pulse">DOM_CRAWL</span>
                  </motion.div>
                )}

                {/* Interactive cursor */}
                {activeStep === 1 && (
                  <motion.div
                    initial={{ x: 200, y: 100 }}
                    animate={{ x: 30, y: 15 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="absolute pointer-events-none"
                  >
                    <svg className="h-5 w-5 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4.5 3v15.2l3.8-3.8 2.9 6.8 2.6-1.1-2.9-6.8 5.3-.3z" />
                    </svg>
                  </motion.div>
                )}

                {/* Visual Alignment Bounding Checks */}
                {activeStep === 2 && (
                  <div className="absolute inset-0 border border-green-500/40 bg-green-500/5 rounded flex items-center justify-center pointer-events-none">
                    <span className="text-[8px] text-green-400 font-mono">ALIGN_OK</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Score Indicator */}
          <div className="border-t border-white/5 pt-4 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground font-mono">Stability recommendation: ready</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Score:</span>
              <span className="text-xs font-bold text-accent">94/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
