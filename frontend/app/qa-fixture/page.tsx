'use client';

import React, { useState } from 'react';

export default function QAFixtureHomePage() {
  const [count, setCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState(false);

  return (
    <div className="space-y-8">
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-4">
        <div className="inline-block bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold px-3 py-1 rounded-full">
          Controlled Test Environment
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          SCULRA QA FIXTURE — Safe Autonomous Test Target
        </h1>
        <p className="text-slate-400 max-w-2xl text-base leading-relaxed">
          This application serves as an officially hosted, deterministic quality assurance fixture. It provides multiple discoverable pages, interactive controls, inputs, and predictable outputs for verification by the Sculra crawler and test runner.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <a
            href="/qa-fixture/features"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition-colors"
          >
            Explore Features &rarr;
          </a>
          <a
            href="/qa-fixture/form"
            className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm transition-colors border border-slate-700"
          >
            Test Input Form
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Interactive State Counter</h2>
          <p className="text-sm text-slate-400">
            Validates DOM interaction, button clicks, and state changes.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <button
              id="fixture-counter-btn"
              data-testid="fixture-counter-btn"
              onClick={() => setCount(c => c + 1)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg text-sm"
            >
              Increment Counter
            </button>
            <span
              id="fixture-counter-val"
              data-testid="fixture-counter-val"
              className="text-lg font-mono text-cyan-300 font-bold"
            >
              Count: {count}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Deterministic Search Input</h2>
          <p className="text-sm text-slate-400">
            Validates form submission, input typing, and synthetic search evaluation.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearchSubmitted(true);
            }}
            className="flex gap-2 pt-2"
          >
            <input
              type="text"
              id="fixture-search-input"
              data-testid="fixture-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fixture..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              id="fixture-search-submit"
              data-testid="fixture-search-submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-sm border border-slate-700"
            >
              Search
            </button>
          </form>
          {searchSubmitted && (
            <p id="search-result-status" className="text-xs text-emerald-400">
              Query received: &ldquo;{searchQuery}&rdquo; — 3 deterministic results available.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
