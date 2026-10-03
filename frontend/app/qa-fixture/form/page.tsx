'use client';

import React, { useState } from 'react';

export default function QAFixtureFormPage() {
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    category: 'feedback',
    priority: 'normal',
    newsletter: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Deterministic Feedback Form</h1>
        <p className="text-slate-400 text-sm mt-1">
          Validates form element discovery, multi-type field entry, and safe client-side form submission.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <form id="fixture-test-form" data-testid="fixture-test-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fixture-fullname" className="block text-sm font-medium text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="fixture-fullname"
              name="fullname"
              data-testid="fixture-fullname"
              required
              value={formData.fullname}
              onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
              placeholder="Jane QA Tester"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="fixture-email" className="block text-sm font-medium text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="fixture-email"
              name="email"
              data-testid="fixture-email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="jane@example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="fixture-category" className="block text-sm font-medium text-slate-300 mb-1">
              Inquiry Category
            </label>
            <select
              id="fixture-category"
              name="category"
              data-testid="fixture-category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="feedback">Product Feedback</option>
              <option value="bug">Bug Report</option>
              <option value="inquiry">General Inquiry</option>
            </select>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-slate-300">Priority Level</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="normal"
                  checked={formData.priority === 'normal'}
                  onChange={() => setFormData({ ...formData, priority: 'normal' })}
                  className="accent-indigo-600"
                />
                Normal
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value="high"
                  checked={formData.priority === 'high'}
                  onChange={() => setFormData({ ...formData, priority: 'high' })}
                  className="accent-indigo-600"
                />
                High
              </label>
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                id="fixture-newsletter"
                name="newsletter"
                data-testid="fixture-newsletter"
                checked={formData.newsletter}
                onChange={(e) => setFormData({ ...formData, newsletter: e.target.checked })}
                className="accent-indigo-600 rounded"
              />
              Subscribe to deterministic testing updates
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="fixture-submit-btn"
              data-testid="fixture-submit-btn"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition-colors"
            >
              Submit Feedback
            </button>
          </div>
        </form>

        {submitted && (
          <div
            id="fixture-form-success"
            data-testid="fixture-form-success"
            className="mt-4 p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-sm"
          >
            Fixture form submitted successfully for &ldquo;{formData.fullname}&rdquo; ({formData.email}). No external network transmission occurred.
          </div>
        )}
      </div>
    </div>
  );
}
