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
    { key: 'desktop' as const, label: 'Desktop (1440px)', status: 'passed', note: 'Passed layout verification checks across wide grids.' },
    { key: 'tablet' as const, label: 'Tablet (768px)', status: 'passed', note: 'Passed layout verification checks on medium breakpoints.' },
    { key: 'mobile' as const, label: 'Mobile (390px)', status: 'failed', note: 'Failed. Navigation links overflow screen boundary.' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Device selector tabs */}
      <div className="flex justify-center gap-2">
        {devices.map((d) => (
          <button
            key={d.key}
            onClick={() => setActiveDevice(d.key)}
            className={`px-4 py-1.5 rounded-full border text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer shadow-xs ${
              activeDevice === d.key
                ? 'border-zinc-950 bg-zinc-950 text-white'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Frame Container */}
      <div className="border border-zinc-200/90 rounded-2xl bg-white p-6 shadow-sm flex flex-col items-center justify-center min-h-[380px] overflow-hidden">
        {/* Dynamic device view mock */}
        <motion.div
          animate={{
            width: activeDevice === 'desktop' ? '100%' : activeDevice === 'tablet' ? '480px' : '280px',
            height: activeDevice === 'desktop' ? '280px' : activeDevice === 'tablet' ? '320px' : '360px',
          }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="border border-zinc-200 rounded-xl bg-zinc-50 shadow-sm flex flex-col justify-between overflow-hidden"
        >
          {/* Header Bar */}
          <div className="px-3.5 py-2 border-b border-zinc-200 bg-white flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span className="font-semibold text-zinc-700">acme-dashboard</span>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${activeDevice === 'mobile' ? 'bg-red-500 animate-pulse' : 'bg-cyan-600'}`} />
              <span className="font-medium text-zinc-700">{activeDevice === 'mobile' ? 'Layout Error' : 'Ready'}</span>
            </div>
          </div>

          {/* Device Page Content */}
          <div className="flex-grow p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-zinc-900">Acme Dashboard</span>

              {/* Navigation Links */}
              {activeDevice !== 'mobile' ? (
                <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-600">
                  <span>Overview</span>
                  <span>Analytics</span>
                  <span>Settings</span>
                </div>
              ) : (
                /* Mobile layout overflow */
                <div className="relative border border-red-300 bg-red-50 px-2 py-0.5 rounded text-[9px] text-red-700 font-bold">
                  <span>Overview Analytics Settings</span>
                  <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
                </div>
              )}
            </div>

            {/* Grid statistics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-zinc-200 rounded-lg bg-white p-3 space-y-1 shadow-xs">
                <div className="h-2 w-8 bg-zinc-200 rounded" />
                <div className="h-4 w-12 bg-zinc-800 rounded" />
              </div>
              <div className="border border-zinc-200 rounded-lg bg-white p-3 space-y-1 shadow-xs">
                <div className="h-2 w-8 bg-zinc-200 rounded" />
                <div className="h-4 w-12 bg-zinc-800 rounded" />
              </div>
            </div>
          </div>

          {/* Footer Diagnostic Panel */}
          <div className="px-3.5 py-2 border-t border-zinc-200 bg-white flex items-center justify-between text-[10px] text-zinc-600 font-mono">
            <span>Viewport: <strong className="text-zinc-900">{activeDevice === 'desktop' ? '1440px' : activeDevice === 'tablet' ? '768px' : '390px'}</strong></span>
            <span className={`font-bold ${activeDevice === 'mobile' ? 'text-red-600' : 'text-cyan-800'}`}>
              {activeDevice === 'mobile' ? '✕ NAVIGATION_OVERFLOW' : '✓ PASSED'}
            </span>
          </div>
        </motion.div>

        {/* Selected device details */}
        <div className="mt-6 text-center text-xs text-zinc-600 max-w-sm">
          <p className="font-extrabold text-zinc-900">
            {activeDevice === 'desktop' ? 'Desktop Frame' : activeDevice === 'tablet' ? 'Tablet Frame' : 'Mobile Frame'}
          </p>
          <p className="text-2xs mt-1">
            {activeDevice === 'desktop' ? devices[0].note : activeDevice === 'tablet' ? devices[1].note : devices[2].note}
          </p>
        </div>
      </div>
    </div>
  );
}
