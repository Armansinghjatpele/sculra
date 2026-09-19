'use client';

// ==============================================================================
// Sculra Human-in-the-Loop Approval Center Page
// (frontend/app/(authenticated)/projects/[projectId]/autonomous/approvals/page.tsx)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { HumanApprovalsPanel } from '@/components/HumanApprovalsPanel';
import {
  Project,
  HumanApprovalRecord,
  mockApprovals,
} from '@/lib/demoData';
import {
  getProject,
  getProjectHumanApprovals,
  decideHumanApproval,
} from '@/services/db';
import {
  Shield,
  ChevronRight,
  RefreshCw,
  Lock,
  ArrowLeft,
} from 'lucide-react';

export default function HumanApprovalsPage() {
  const params = useParams();
  const { getToken, userId } = useAuth();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [approvals, setApprovals] = useState<HumanApprovalRecord[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const effectiveToken = token || 'demo-token';

      const [proj, apprs] = await Promise.all([
        getProject(effectiveToken, projectId),
        getProjectHumanApprovals(effectiveToken, projectId),
      ]);

      setProject(proj);
      setApprovals(apprs.length > 0 ? apprs : mockApprovals);
    } catch (err) {
      console.error('[Approvals Page Error]:', err);
      setApprovals(mockApprovals);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDecide = async (
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string
  ) => {
    const token = await getToken();
    const effectiveToken = token || 'demo-token';
    const effectiveUser = userId || 'Operator';

    await decideHumanApproval(
      effectiveToken,
      approvalId,
      decision,
      reason,
      effectiveUser
    );

    await loadData();
  };

  return (
    <div className="space-y-6 pb-12">
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
            <span className="text-zinc-300 font-medium">Human Approvals</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-amber-400" />
            Human-in-the-Loop Approval Center
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Review and authorize autonomous code remediations, PR creations, and critical security gate decisions.
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

      {/* Main Approvals Panel */}
      <HumanApprovalsPanel
        approvals={approvals}
        onDecide={handleDecide}
      />
    </div>
  );
}
