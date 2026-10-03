import React from 'react';

export const metadata = {
  title: 'SCULRA QA FIXTURE — Safe Autonomous Test Target',
  description: 'Deterministic test fixture target for Sculra Autonomous QA verification.',
};

export default function QAFixtureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded">
              SCULRA QA FIXTURE
            </span>
            <span className="text-slate-400 text-sm">Deterministic Test Target</span>
          </div>
          <nav aria-label="Fixture Navigation" className="flex items-center gap-4 text-sm font-medium">
            <a href="/qa-fixture" data-testid="nav-fixture-home" className="text-cyan-400 hover:text-cyan-300">
              Home
            </a>
            <a href="/qa-fixture/features" data-testid="nav-fixture-features" className="text-slate-300 hover:text-white">
              Features
            </a>
            <a href="/qa-fixture/form" data-testid="nav-fixture-form" className="text-slate-300 hover:text-white">
              Feedback Form
            </a>
            <a href="/qa-fixture/responsive" data-testid="nav-fixture-responsive" className="text-slate-300 hover:text-white">
              Responsive
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="bg-slate-900 border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
        SCULRA QA FIXTURE — Safe Autonomous Test Target. Does not process payments, collect personal data, or modify external state.
      </footer>
    </div>
  );
}
