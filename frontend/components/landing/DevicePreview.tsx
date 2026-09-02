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
    { key: 'desktop' as const, label: 'Desktop (1440px)', status: 'passed', note: 'All grid alignments, modals, and tables verified across wide viewports.' },
    { key: 'tablet' as const, label: 'Tablet (768px)', status: 'passed', note: 'Collapsible sidebar and responsive cards conform to medium breakpoint rules.' },
    { key: 'mobile' as const, label: 'Mobile (390px)', status: 'failed', note: 'Navigation tabs overflow screen width; horizontal scrollbar triggered.' },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Device selector tabs */}
      <div className="flex justify-center gap-2">
        {devices.map((d) => (
          <button
            key={d.key}
            onClick={() => setActiveDevice(d.key)}
            className={`px-4 py-2 rounded-full border text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer shadow-xs ${
              activeDevice === d.key
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-md ring-1 ring-zinc-950'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Frame Container - Larger, rich viewport sandbox */}
      <div className="border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-8 shadow-lg flex flex-col items-center justify-center min-h-[440px] overflow-hidden">
        {/* Dynamic device view mock */}
        <motion.div
          animate={{
            width: activeDevice === 'desktop' ? '100%' : activeDevice === 'tablet' ? '540px' : '320px',
            height: activeDevice === 'desktop' ? '320px' : activeDevice === 'tablet' ? '360px' : '390px',
          }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="border border-zinc-200 rounded-xl bg-zinc-50/80 shadow-md flex flex-col justify-between overflow-hidden"
        >
          {/* Header Bar */}
          <div className="px-4 py-2.5 border-b border-zinc-200 bg-white flex items-center justify-between text-[11px] font-mono text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-800">app.sculra.com</span>
              <span className="text-zinc-400">/dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${activeDevice === 'mobile' ? 'bg-red-500 animate-pulse' : 'bg-cyan-600'}`} />
              <span className="font-semibold text-zinc-800">{activeDevice === 'mobile' ? 'Layout Overflow' : 'Responsive OK'}</span>
            </div>
          </div>

          {/* Device Page Content with rich dashboard UI */}
          <div className="flex-grow p-5 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-zinc-950 text-white font-bold text-[10px] flex items-center justify-center">S</div>
                <span className="font-black text-xs text-zinc-950">Sculra QA</span>
              </div>

              {/* Navigation Links */}
              {activeDevice !== 'mobile' ? (
                <div className="flex items-center gap-4 text-[11px] font-semibold text-zinc-600">
                  <span className="text-zinc-950 font-bold">Overview</span>
                  <span>Test Runs</span>
                  <span>Diagnostics</span>
                  <span>Settings</span>
                </div>
              ) : (
                /* Mobile layout overflow */
                <div className="relative border-2 border-red-400 bg-red-50 px-2.5 py-1 rounded text-[10px] text-red-700 font-bold whitespace-nowrap">
                  <span>Overview Test-Runs Diagnostics Settings</span>
                  <div className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-red-600 ring-2 ring-white" />
                </div>
              )}
            </div>

            {/* Metric Cards Grid */}
            <div className={`grid gap-3 ${activeDevice === 'desktop' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="border border-zinc-200 rounded-xl bg-white p-3.5 space-y-1 shadow-xs">
                <div className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Pass Rate</div>
                <div className="text-lg font-black text-zinc-950 font-mono">98.4%</div>
                <div className="text-[10px] text-cyan-800 font-bold">+2.1% this sprint</div>
              </div>
              <div className="border border-zinc-200 rounded-xl bg-white p-3.5 space-y-1 shadow-xs">
                <div className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Execution</div>
                <div className="text-lg font-black text-zinc-950 font-mono">34s</div>
                <div className="text-[10px] text-zinc-500 font-sans">Avg duration</div>
              </div>
              {activeDevice === 'desktop' && (
                <div className="border border-zinc-200 rounded-xl bg-white p-3.5 space-y-1 shadow-xs">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Coverage</div>
                  <div className="text-lg font-black text-zinc-950 font-mono">100%</div>
                  <div className="text-[10px] text-zinc-500 font-sans">All routes mapped</div>
                </div>
              )}
            </div>

            {/* Test Run Table Item */}
            <div className="border border-zinc-200 rounded-xl bg-white p-3 flex items-center justify-between text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-cyan-600" />
                <span className="font-bold text-zinc-900">PR #84 — Auth Regression Suite</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 font-medium">Passed in 28s</span>
            </div>
          </div>

          {/* Footer Diagnostic Panel */}
          <div className="px-4 py-2.5 border-t border-zinc-200 bg-white flex items-center justify-between text-[11px] text-zinc-600 font-mono">
            <span>Viewport: <strong className="text-zinc-950">{activeDevice === 'desktop' ? '1440 × 900' : activeDevice === 'tablet' ? '768 × 1024' : '390 × 844'}</strong></span>
            <span className={`font-bold ${activeDevice === 'mobile' ? 'text-red-600' : 'text-cyan-900'}`}>
              {activeDevice === 'mobile' ? '✕ NAVIGATION_OVERFLOW_FAIL' : '✓ VIEWPORT_ASSERT_PASSED'}
            </span>
          </div>
        </motion.div>

        {/* Selected device details */}
        <div className="mt-6 text-center text-xs text-zinc-600 max-w-md">
          <p className="font-extrabold text-zinc-950 text-sm">
            {activeDevice === 'desktop' ? 'Desktop Frame (1440px)' : activeDevice === 'tablet' ? 'Tablet Frame (768px)' : 'Mobile Compact Frame (390px)'}
          </p>
          <p className="text-xs mt-1 text-zinc-600 leading-relaxed font-sans">
            {activeDevice === 'desktop' ? devices[0].note : activeDevice === 'tablet' ? devices[1].note : devices[2].note}
          </p>
        </div>
      </div>
    </div>
  );
}
