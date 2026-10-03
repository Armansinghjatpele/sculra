'use client';

import React, { useState } from 'react';

export default function QAFixtureFeaturesPage() {
  const [activeTab, setActiveTab] = useState<'crawler' | 'visual'>('crawler');
  const [brokenClicked, setBrokenClicked] = useState(false);

  const handleBrokenClick = () => {
    setBrokenClicked(true);
    // Intentionally log a deterministic error for QA crawler observation
    console.error('Sculra QA Fixture: Deterministic intentional runtime error logged on interactive control.');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Interactive Features & Controls</h1>
        <p className="text-slate-400 text-sm mt-1">
          Provides tabs, accordions, and deterministic controls for crawl and interaction verification.
        </p>
      </div>

      {/* Accordion / Expandable Control */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Expandable FAQ Accordion</h2>
        <details id="fixture-faq-accordion" data-testid="fixture-faq-accordion" className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          <summary className="font-medium text-cyan-400 cursor-pointer select-none">
            What is the purpose of this QA fixture?
          </summary>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            This fixture provides verified, deterministic target states for testing Playwright autonomous navigation, accessibility compliance, visual checks, and issue detection.
          </p>
        </details>
      </section>

      {/* Tab Controls */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Feature View Tabs</h2>
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          <button
            id="fixture-tab-crawler"
            data-testid="fixture-tab-crawler"
            onClick={() => setActiveTab('crawler')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'crawler'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Autonomous Discovery
          </button>
          <button
            id="fixture-tab-visual"
            data-testid="fixture-tab-visual"
            onClick={() => setActiveTab('visual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'visual'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            Visual QA & Responsive
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
          {activeTab === 'crawler' ? (
            <div id="tab-content-crawler" data-testid="tab-content-crawler">
              <h3 className="font-semibold text-cyan-300 text-sm">Autonomous Crawler Verification</h3>
              <p className="text-sm text-slate-400 mt-1">
                Discovers DOM nodes, extracts clickable paths, and generates structured interaction plans.
              </p>
            </div>
          ) : (
            <div id="tab-content-visual" data-testid="tab-content-visual">
              <h3 className="font-semibold text-cyan-300 text-sm">Visual & Layout Verification</h3>
              <p className="text-sm text-slate-400 mt-1">
                Validates viewport dimensions, responsive reflow, and element visibility across screen sizes.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Deterministic Detectable QA Issue */}
      <section className="bg-slate-900 border border-rose-950/40 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-white">Deterministic Issue Target</h2>
        <p className="text-sm text-slate-400">
          Clicking this button emits an intentional, deterministic console exception for observation by autonomous test runners.
        </p>
        <button
          id="fixture-broken-action-btn"
          data-testid="fixture-broken-action-btn"
          onClick={handleBrokenClick}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-lg text-sm transition-colors"
        >
          Trigger Deterministic Action Error
        </button>
        {brokenClicked && (
          <p id="fixture-error-feedback" className="text-xs text-rose-400 font-mono">
            Error logged to console: &ldquo;Sculra QA Fixture: Deterministic intentional runtime error logged on interactive control.&rdquo;
          </p>
        )}
      </section>
    </div>
  );
}
