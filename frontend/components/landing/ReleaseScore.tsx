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
    { name: 'Functionality', val: 92, status: 'passed' },
    { name: 'Visual Quality', val: 78, status: 'needs_review' },
    { name: 'Responsive Fit', val: 88, status: 'passed' },
    { name: 'Accessibility', val: 74, status: 'needs_review' },
    { name: 'Performance Load', val: 81, status: 'passed' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-center">
      {/* Left: Big Circular Release Readiness Score */}
      <div className="flex flex-col items-center justify-center border border-zinc-200/90 rounded-2xl bg-white p-8 shadow-sm text-center relative overflow-hidden h-80">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 font-mono">Release Readiness</span>
        
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background Circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-zinc-100"
              strokeWidth="7"
              fill="transparent"
            />
            {/* Animated Gauge Ring */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-cyan-700"
              strokeWidth="7"
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
            <span className="text-4xl font-black text-zinc-950 tracking-tight">{score}</span>
            <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest mt-1">/ 100</span>
          </div>
        </div>

        <div className="mt-6 text-[10px] font-mono text-red-700 font-bold bg-red-50 px-3 py-1 border border-red-200 rounded-full">
          ✕ Release Blocked: 2 high-impact issues need review
        </div>
      </div>

      {/* Right: Scores Breakdown List */}
      <div className="border border-zinc-200/90 rounded-2xl bg-white p-8 shadow-sm space-y-5">
        <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider border-b border-zinc-100 pb-3">
          Quality Dimensions
        </h3>

        <div className="space-y-4">
          {categories.map((c, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-zinc-800">{c.name}</span>
                <span className="font-mono text-zinc-500 font-medium">{c.val}%</span>
              </div>
              
              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.val}%` }}
                  transition={{ duration: 1.2, delay: idx * 0.1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${c.status === 'passed' ? 'bg-cyan-700' : 'bg-zinc-400'}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
