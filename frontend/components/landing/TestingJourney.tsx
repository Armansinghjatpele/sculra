'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

export function TestingJourney() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto items-center">
      {/* Left: Section 2 - The Complex App Problem */}
      <div className="relative border border-white/5 rounded-xl bg-zinc-950/20 p-8 shadow-glass overflow-hidden h-96 flex flex-col justify-between">
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-danger uppercase tracking-wider">Complexity Explosion</span>
          <h3 className="text-lg font-bold text-foreground">Paths Grow Exponentially</h3>
          <p className="text-xs text-muted-foreground">Every route branch introduces dozens of user states, devices, viewports, and roles.</p>
        </div>

        <div className="flex-1 flex items-center justify-center relative py-6">
          <svg className="w-full h-full max-h-56 font-mono text-[9px] text-muted-foreground" viewBox="0 0 400 200">
            {/* Connection Lines with animation */}
            <motion.path
              d="M 200 20 L 200 60 M 200 60 L 100 100 M 200 60 L 200 100 M 200 60 L 300 100 M 100 100 L 50 140 M 100 100 L 150 140 M 300 100 L 250 140 M 300 100 L 350 140"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
            />
            <motion.path
              d="M 200 20 L 200 60 M 200 60 L 100 100 M 200 60 L 200 100 M 200 60 L 300 100 M 100 100 L 50 140 M 100 100 L 150 140 M 300 100 L 250 140 M 300 100 L 350 140"
              fill="none"
              stroke="url(#accent-glow-gradient)"
              strokeWidth="1.5"
              strokeDasharray="400"
              animate={{ strokeDashoffset: [400, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            />

            <defs>
              <linearGradient id="accent-glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00D4FF" stopOpacity="0" />
                <stop offset="50%" stopColor="#00D4FF" stopOpacity="1" />
                <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Nodes */}
            <circle cx="200" cy="20" r="5" fill="#fff" />
            <text x="210" y="23" fill="#fff">/home</text>

            <circle cx="200" cy="60" r="5" fill="rgba(255,255,255,0.3)" />
            <text x="210" y="63">/login</text>

            <circle cx="100" cy="100" r="5" fill="rgba(255,255,255,0.3)" />
            <text x="75" y="93">/dashboard</text>

            <circle cx="200" cy="100" r="5" fill="rgba(255,255,255,0.3)" />
            <text x="210" y="103">/reports</text>

            <circle cx="300" cy="100" r="5" fill="rgba(255,255,255,0.3)" />
            <text x="310" y="103">/settings</text>

            {/* Deep Branches */}
            <circle cx="50" cy="140" r="4" fill="rgba(255,255,255,0.15)" />
            <text x="25" y="155">/projects</text>

            <circle cx="150" cy="140" r="4" fill="rgba(255,255,255,0.15)" />
            <text x="135" y="155">/billing</text>

            <circle cx="250" cy="140" r="4" fill="rgba(255,255,255,0.15)" />
            <text x="235" y="155">/profile</text>

            <circle cx="350" cy="140" r="4" fill="rgba(255,255,255,0.15)" />
            <text x="335" y="155">/keys</text>
          </svg>
        </div>

        <div className="text-[10px] font-mono text-accent text-center bg-accent/5 py-1 border border-accent/15 rounded">
          Sculra explores them for you.
        </div>
      </div>

      {/* Right: Section 7 - AI User Journeys */}
      <div className="relative border border-white/5 rounded-xl bg-zinc-950/20 p-8 shadow-glass overflow-hidden h-96 flex flex-col justify-between">
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-accent uppercase tracking-wider">AI User Journeys</span>
          <h3 className="text-lg font-bold text-foreground">Don&apos;t Test Pages. Test Experiences.</h3>
          <p className="text-xs text-muted-foreground">Sculra tests state workflows, traversing routes sequentially to reproduce real user logic.</p>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-4 py-4">
          {/* User Experience A */}
          <div className="space-y-2">
            <div className="text-[9px] font-bold text-muted-foreground uppercase font-mono tracking-wider">Student Experience:</div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px]">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-foreground">Login</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-foreground">Open Dashboard</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-foreground">Timetable</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-0.5 rounded border border-danger/30 bg-danger/5 text-danger font-semibold">Attendance Fails</span>
            </div>
          </div>

          {/* User Experience B */}
          <div className="space-y-2">
            <div className="text-[9px] font-bold text-muted-foreground uppercase font-mono tracking-wider">Developer Experience:</div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px]">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-foreground">Login</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-foreground">Create Project</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-foreground">Sync API Keys</span>
              <span className="text-muted-foreground">→</span>
              <span className="px-2 py-0.5 rounded border border-green-500/30 bg-green-500/5 text-green-400 font-semibold">Ready to Ship</span>
            </div>
          </div>
        </div>

        <div className="text-[9px] text-muted-foreground text-center">
          Sculra models multi-step sequences to discover edge case regressions.
        </div>
      </div>
    </div>
  );
}
