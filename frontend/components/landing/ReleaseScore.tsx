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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto items-center">
      {/* Left: Big Circular Release Readiness Score */}
      <div className="flex flex-col items-center justify-center border border-white/5 rounded-xl bg-zinc-950/20 p-8 shadow-glass text-center relative overflow-hidden h-80">
        <span className="text-[10px] font-bold text-accent uppercase tracking-wider mb-4">Release Readiness</span>
        
        <div className="relative w-44 h-44 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background Circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-zinc-800"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Animated Gauge Ring */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              className="stroke-accent"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray="251.2"
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * score) / 100 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </svg>

          {/* Absolute Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold text-foreground">{score}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest mt-1">/ 100</span>
          </div>
        </div>

        <div className="mt-6 text-[10px] font-mono text-danger font-semibold bg-danger/10 px-3 py-1 border border-danger/15 rounded">
          ✕ Release Blocked: 2 high-impact issues need review
        </div>
      </div>

      {/* Right: Scores Breakdown List */}
      <div className="border border-white/5 rounded-xl bg-zinc-950/40 p-8 shadow-glass space-y-5">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-widest border-b border-white/5 pb-2">
          Quality Dimensions
        </h3>

        <div className="space-y-4">
          {categories.map((c, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-semibold text-foreground">{c.name}</span>
                <span className="font-mono text-muted-foreground">{c.val}%</span>
              </div>
              
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.val}%` }}
                  transition={{ duration: 1.2, delay: idx * 0.1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${c.status === 'passed' ? 'bg-accent' : 'bg-warning'}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
