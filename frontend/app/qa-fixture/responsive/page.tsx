import React from 'react';

export default function QAFixtureResponsivePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Responsive Layout Demonstration</h1>
        <p className="text-slate-400 text-sm mt-1">
          Validates viewport adaptation across desktop, tablet, and mobile breakpoints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm mb-3">
            01
          </div>
          <h2 className="text-lg font-semibold text-white">Adaptive Column A</h2>
          <p className="text-sm text-slate-400 mt-2">
            Reflows from a 3-column layout on wide screens to a stacked single-column layout on mobile viewports.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm mb-3">
            02
          </div>
          <h2 className="text-lg font-semibold text-white">Adaptive Column B</h2>
          <p className="text-sm text-slate-400 mt-2">
            Maintains fluid typography, appropriate contrast ratios, and touch-target minimum dimensions.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-3">
            03
          </div>
          <h2 className="text-lg font-semibold text-white">Adaptive Column C</h2>
          <p className="text-sm text-slate-400 mt-2">
            No horizontal page overflow or clipping across standard viewports (375px to 1920px).
          </p>
        </div>
      </div>
    </div>
  );
}
