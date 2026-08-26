'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export function DevicePreview() {
  const [activeDevice, setActiveDevice] = React.useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveDevice((prev) => {
        if (prev === 'desktop') return 'tablet';
        if (prev === 'tablet') return 'mobile';
        return 'desktop';
      });
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const devices = [
    { key: 'desktop' as const, label: 'Desktop (1440px)', status: 'passed', note: 'Passed layout verification checks.' },
    { key: 'tablet' as const, label: 'Tablet (768px)', status: 'passed', note: 'Passed layout verification checks.' },
    { key: 'mobile' as const, label: 'Mobile (390px)', status: 'failed', note: 'Failed. Navigation links overflow container.' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Device selector tabs */}
      <div className="flex justify-center gap-2">
        {devices.map((d) => (
          <button
            key={d.key}
            onClick={() => setActiveDevice(d.key)}
            className={`px-3 py-1.5 rounded-full border text-[10px] font-semibold tracking-wider uppercase transition-all duration-300 ${
              activeDevice === d.key
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-white/5 bg-zinc-950/20 text-muted-foreground hover:border-white/10'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Frame Container */}
      <div className="border border-white/5 rounded-xl bg-zinc-950/40 p-6 flex flex-col items-center justify-center min-h-[360px] overflow-hidden">
        {/* Dynamic device view mock */}
        <motion.div
          animate={{
            width: activeDevice === 'desktop' ? '100%' : activeDevice === 'tablet' ? '480px' : '280px',
            height: activeDevice === 'desktop' ? '280px' : activeDevice === 'tablet' ? '320px' : '360px',
          }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="border border-white/10 rounded-lg bg-zinc-900 shadow-glass flex flex-col justify-between overflow-hidden"
        >
          {/* Header Bar */}
          <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between text-[8px] font-mono text-muted-foreground">
            <span>acme-dashboard</span>
            <div className="flex gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${activeDevice === 'mobile' ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
              <span>{activeDevice === 'mobile' ? 'Layout Error' : 'Ready'}</span>
            </div>
          </div>

          {/* Device Page Content */}
          <div className="flex-grow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[10px]">Acme Dashboard</span>

              {/* Navigation Links (Simulates overflow error) */}
              {activeDevice !== 'mobile' ? (
                <div className="flex items-center gap-3 text-[8px] text-muted-foreground">
                  <span>Overview</span>
                  <span>Analytics</span>
                  <span>Settings</span>
                </div>
              ) : (
                /* Mobile layout overflow: navigations overlap title or break margins */
                <div className="relative border border-red-500/30 bg-red-500/5 px-2 py-0.5 rounded text-[7px] text-danger font-semibold">
                  <span>Overview Analytics Settings</span>
                  <div className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                </div>
              )}
            </div>

            {/* Grid statistics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-white/5 rounded p-3 space-y-1">
                <div className="h-2 w-8 bg-white/10 rounded" />
                <div className="h-3.5 w-12 bg-white/5 rounded" />
              </div>
              <div className="border border-white/5 rounded p-3 space-y-1">
                <div className="h-2 w-8 bg-white/10 rounded" />
                <div className="h-3.5 w-12 bg-white/5 rounded" />
              </div>
            </div>
          </div>

          {/* Footer Diagnostic Panel */}
          <div className="px-3 py-2 border-t border-white/5 bg-black/40 flex items-center justify-between text-[8px] text-muted-foreground font-mono">
            <span>Viewport: {activeDevice === 'desktop' ? '1440px' : activeDevice === 'tablet' ? '768px' : '390px'}</span>
            <span className={activeDevice === 'mobile' ? 'text-danger font-bold' : 'text-green-400'}>
              {activeDevice === 'mobile' ? '✕ NAVIGATION_OVERFLOW' : '✓ PASSED'}
            </span>
          </div>
        </motion.div>

        {/* Selected device details */}
        <div className="mt-6 text-center text-xs text-muted-foreground max-w-sm">
          <p className="font-semibold text-foreground">
            {activeDevice === 'desktop' ? 'Desktop Frame' : activeDevice === 'tablet' ? 'Tablet Frame' : 'Mobile Frame'}
          </p>
          <p className="text-4xs mt-1">
            {activeDevice === 'desktop' ? devices[0].note : activeDevice === 'tablet' ? devices[1].note : devices[2].note}
          </p>
        </div>
      </div>
    </div>
  );
}
