'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export function ReleaseScore() {
  const [score, setScore] = React.useState(0);
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setScore(83);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const categories = [
    { name: 'Functionality & Route State', val: 92, status: 'passed' },
    { name: 'Visual Layout & Alignment', val: 78, status: 'needs_review' },
    { name: 'Responsive Viewport Matrix', val: 88, status: 'passed' },
    { name: 'Accessibility & Contrast (WCAG)', val: 74, status: 'needs_review' },
    { name: 'Performance & LCP Load', val: 81, status: 'passed' },
  ];

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
      {/* Left: Big Circular Release Readiness Score (5 cols) */}
      <div className="md:col-span-5 flex flex-col items-center justify-between border border-zinc-200/90 rounded-2xl bg-white p-7 shadow-lg text-center relative overflow-hidden min-h-[380px]">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Release Readiness Index</span>
          <div className="text-xs text-zinc-500">Autonomous QA Build Assertion</div>
        </div>
        
        <div className="relative w-48 h-48 flex items-center justify-center my-2">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background Circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-zinc-100"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Animated Gauge Ring - Semantic Brand Color */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-cyan-600"
              strokeWidth="8"
              strokeLinecap="round"
              fill="transparent"
              strokeDasharray="251.2"
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * score) / 100 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </svg>

          {/* Absolute Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-zinc-950 tracking-tight font-mono">{score}</span>
            <span className="text-[11px] text-zinc-500 uppercase font-mono tracking-widest mt-1 font-bold">/ 100 PTS</span>
          </div>
        </div>

        {/* Semantic Status Gate */}
        <div className="text-[11px] font-mono text-red-700 font-bold bg-red-50 px-3.5 py-1.5 border border-red-200 rounded-full flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
          <span>✕ Merge Blocked: Score below 90% threshold</span>
        </div>
      </div>

      {/* Right: Scores Breakdown List with Semantic Color Bars (7 cols) */}
      <div className="md:col-span-7 border border-zinc-200/90 rounded-2xl bg-white p-7 shadow-lg space-y-5 flex flex-col justify-between">
        <div className="space-y-1 pb-3 border-b border-zinc-100">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider font-mono">
              Quality Dimensions Breakdown
            </h3>
            <span className="text-[11px] font-mono text-zinc-500">5 Automated Vectors</span>
          </div>
          <p className="text-xs text-zinc-600">Calculated across 34 crawled routes and 142 interactive states.</p>
        </div>

        <div className="space-y-4">
          {categories.map((c, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-800">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    c.status === 'passed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {c.status === 'passed' ? 'PASSED' : 'NEEDS REVIEW'}
                  </span>
                  <span className="font-mono text-zinc-900 font-extrabold w-10 text-right">{c.val}%</span>
                </div>
              </div>
              
              <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.val}%` }}
                  transition={{ duration: 1.2, delay: idx * 0.1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${c.status === 'passed' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 flex justify-between items-center font-mono">
          <span>Target Score Threshold: <strong className="text-zinc-950">90%</strong></span>
          <span className="text-cyan-800 font-bold">Auto-posted to PR #42</span>
        </div>
      </div>
    </div>
  );
}
