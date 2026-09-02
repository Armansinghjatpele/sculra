import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {}

export function Footer({ className, ...props }: FooterProps) {
  return (
    <footer
      className={cn('border-t border-zinc-200 bg-white text-zinc-600 pt-16 pb-12 text-xs font-mono', className)}
      {...props}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Multi-Column Grouped Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info Column (2 cols on md) */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <div className="h-7 w-7 rounded-lg bg-zinc-950 flex items-center justify-center text-white shadow-xs">
                <svg
                  className="h-4 w-4 text-cyan-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-base font-black tracking-tight text-zinc-950 font-sans">Sculra</span>
              <span className="text-[10px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                AI QA Engine
              </span>
            </div>

            <p className="text-xs text-zinc-500 max-w-sm leading-relaxed font-sans font-normal">
              Autonomous AI QA Engineer that crawls applications, identifies functional exceptions, visual regressions, and responsive layout shifts with zero manual scripting.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-zinc-700 font-semibold">Systems Operational • Global Edge</span>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-950">Product</div>
            <ul className="space-y-2 text-zinc-500">
              <li>
                <Link href="/features" className="hover:text-zinc-950 transition-colors">Features & Capabilities</Link>
              </li>
              <li>
                <Link href="/enterprise" className="hover:text-zinc-950 transition-colors">Enterprise VPC</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-zinc-950 transition-colors">Pricing & Plans</Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-zinc-950 transition-colors">Documentation</Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-zinc-950 transition-colors">App Dashboard</Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-950">Resources</div>
            <ul className="space-y-2 text-zinc-500">
              <li>
                <Link href="/activity" className="hover:text-zinc-950 transition-colors">Live Activity</Link>
              </li>
              <li>
                <Link href="/ai-insights" className="hover:text-zinc-950 transition-colors">AI Insights & Diagnostics</Link>
              </li>
              <li>
                <Link href="/test-runs" className="hover:text-zinc-950 transition-colors">Test Runs Explorer</Link>
              </li>
              <li>
                <Link href="/api-keys" className="hover:text-zinc-950 transition-colors">API Keys & Tokens</Link>
              </li>
              <li>
                <Link href="/status" className="hover:text-zinc-950 transition-colors">System Status</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company & Legal */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-950">Company & Legal</div>
            <ul className="space-y-2 text-zinc-500">
              <li>
                <Link href="/about" className="hover:text-zinc-950 transition-colors">About Sculra</Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-zinc-950 transition-colors">Contact Support</Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-zinc-950 transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-zinc-950 transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-zinc-950 transition-colors">Engineering Blog</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} Sculra, Inc. All rights reserved.
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-900 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-900 transition-colors">Terms</Link>
            <Link href="/status" className="hover:text-zinc-900 transition-colors">Status</Link>
            <Link href="/contact" className="hover:text-zinc-900 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
