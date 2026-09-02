'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export function TestingJourney() {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
      {/* Left: The Complex App Problem */}
      <div className="relative border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-7 shadow-lg overflow-hidden flex flex-col justify-between min-h-[380px]">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 uppercase tracking-wider font-mono w-fit">
            Complexity Explosion
          </span>
          <h3 className="text-base font-extrabold text-zinc-950 tracking-tight">Paths Grow Exponentially</h3>
          <p className="text-xs text-zinc-600">Every route branch introduces dozens of user states, devices, viewports, and roles.</p>
        </div>

        <div className="flex-1 flex items-center justify-center relative py-4">
          <svg className="w-full h-full max-h-56 font-mono text-[9px] text-zinc-600" viewBox="0 0 400 200">
            <defs>
              <linearGradient id="brand-journey-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>

            {/* Connection Lines with animation */}
            <motion.path
              d="M 200 20 L 200 60 M 200 60 L 100 100 M 200 60 L 200 100 M 200 60 L 300 100 M 100 100 L 50 140 M 100 100 L 150 140 M 300 100 L 250 140 M 300 100 L 350 140"
              fill="none"
              stroke="#e4e4e7"
              strokeWidth="2"
            />
            <motion.path
              d="M 200 20 L 200 60 M 200 60 L 100 100 M 200 60 L 200 100 M 200 60 L 300 100 M 100 100 L 50 140 M 100 100 L 150 140 M 300 100 L 250 140 M 300 100 L 350 140"
              fill="none"
              stroke="url(#brand-journey-gradient)"
              strokeWidth="2.5"
              strokeDasharray="400"
              animate={{ strokeDashoffset: [400, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            />

            {/* Nodes */}
            <circle cx="200" cy="20" r="5" fill="#09090b" />
            <text x="212" y="24" fill="#09090b" fontWeight="bold">/home</text>

            <circle cx="200" cy="60" r="5" fill="#71717a" />
            <text x="212" y="64" fill="#52525b">/login</text>

            <circle cx="100" cy="100" r="5" fill="#71717a" />
            <text x="75" y="93" fill="#52525b">/dashboard</text>

            <circle cx="200" cy="100" r="5" fill="#71717a" />
            <text x="212" y="104" fill="#52525b">/reports</text>

            <circle cx="300" cy="100" r="5" fill="#71717a" />
            <text x="312" y="104" fill="#52525b">/settings</text>

            {/* Deep Branches */}
            <circle cx="50" cy="140" r="4" fill="#a1a1aa" />
            <text x="25" y="156" fill="#71717a">/projects</text>

            <circle cx="150" cy="140" r="4" fill="#a1a1aa" />
            <text x="135" y="156" fill="#71717a">/billing</text>

            <circle cx="250" cy="140" r="4" fill="#a1a1aa" />
            <text x="235" y="156" fill="#71717a">/profile</text>

            <circle cx="350" cy="140" r="4" fill="#a1a1aa" />
            <text x="335" y="156" fill="#71717a">/keys</text>
          </svg>
        </div>

        <div className="text-[10px] font-mono text-cyan-900 text-center bg-cyan-50 py-1.5 border border-cyan-200 rounded-lg font-bold">
          Sculra maps every permutation automatically.
        </div>
      </div>

      {/* Right: AI User Journeys */}
      <div className="relative border border-zinc-200/90 rounded-2xl bg-white p-6 sm:p-7 shadow-lg overflow-hidden flex flex-col justify-between min-h-[380px]">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
            AI User Journeys
          </span>
          <h3 className="text-base font-extrabold text-zinc-950 tracking-tight">Don&apos;t Test Pages. Test Experiences.</h3>
          <p className="text-xs text-zinc-600">Sculra models multi-step state workflows, executing sequences like real users.</p>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-4 py-3">
          {/* User Experience A */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider">End-User Checkout Flow:</div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-900 font-semibold shadow-xs">Login</span>
              <span className="text-zinc-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-900 font-semibold shadow-xs">Select Plan</span>
              <span className="text-zinc-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-900 font-semibold shadow-xs">Add Coupon</span>
              <span className="text-zinc-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded-md border border-red-300 bg-red-50 text-red-700 font-bold shadow-xs">✕ Modal Collision</span>
            </div>
          </div>

          {/* User Experience B */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-zinc-500 uppercase font-mono tracking-wider">Developer CI Integration Flow:</div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-900 font-semibold shadow-xs">Git Commit</span>
              <span className="text-zinc-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-900 font-semibold shadow-xs">PR Webhook</span>
              <span className="text-zinc-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-900 font-semibold shadow-xs">Agent Audit</span>
              <span className="text-zinc-400 font-bold">→</span>
              <span className="px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold shadow-xs">✓ Ready to Merge</span>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-zinc-500 text-center font-medium font-mono">
          Traversing full application state matrices in parallel.
        </div>
      </div>
    </div>
  );
}
