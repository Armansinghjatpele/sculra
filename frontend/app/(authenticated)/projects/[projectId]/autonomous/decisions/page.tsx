'use client';

// ==============================================================================
// Sculra Explainable Decisions Explorer Page
// (frontend/app/(authenticated)/projects/[projectId]/autonomous/decisions/page.tsx)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { DecisionExplorer } from '@/components/DecisionExplorer';
import {
  Project,
  DecisionRecord,
} from '@/lib/demoData';
import {
  getProject,
  getProjectAutonomousDecisions,
} from '@/services/db';
import {
  HelpCircle,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';

export default function DecisionsExplorerPage() {
  const params = useParams();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const effectiveToken = token || '';

      const [proj, decs] = await Promise.all([
        getProject(effectiveToken, projectId),
        getProjectAutonomousDecisions(effectiveToken, projectId, 100),
      ]);

      setProject(proj);
      setDecisions(decs || []);
      setError(null);
    } catch (err: any) {
      console.error('[Decisions Page Error]:', err);
      setError(err?.message || 'Failed loading decisions.');
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 pb-12">
      {error && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 font-semibold"
          >
            Retry
          </button>
        </div>
      )}
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <Link href="/projects" className="hover:text-zinc-300">
              Projects
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href={`/projects/${projectId}`} className="hover:text-zinc-300">
              {project?.name || projectId}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link
              href={`/projects/${projectId}/autonomous`}
              className="hover:text-zinc-300"
            >
              Control Center
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-zinc-300 font-medium">Explainable Decisions</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <HelpCircle className="w-6 h-6 text-purple-400" />
            Autonomous Decision Audit Explorer
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Inspect &quot;Why&quot; decisions were made: test target prioritizations, skip reasons, quarantine policies, and remediation triggers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${projectId}/autonomous`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Control Center
          </Link>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Decisions Explorer */}
      <DecisionExplorer decisions={decisions} />
    </div>
  );
}
