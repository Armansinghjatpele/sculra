'use client';

// ==============================================================================
// Sculra Autonomous QA Observability & Control Center
// (frontend/app/(authenticated)/projects/[projectId]/autonomous/page.tsx)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { WhatSculraIsDoingCard } from '@/components/WhatSculraIsDoingCard';
import { AutonomousHealthPanel } from '@/components/AutonomousHealthPanel';
import { AutonomousTimeline } from '@/components/AutonomousTimeline';
import { DecisionExplorer } from '@/components/DecisionExplorer';
import { EvidenceGraphViewer } from '@/components/EvidenceGraphViewer';
import { HumanApprovalsPanel } from '@/components/HumanApprovalsPanel';
import {
  Project,
  AutonomousEvent,
  DecisionRecord,
  HumanApprovalRecord,
  AutonomousHealthMetrics,
  EvidenceGraph,
  Campaign,
  CampaignTask,
} from '@/lib/demoData';
import {
  getProject,
  getProjectAutonomousEvents,
  getProjectAutonomousDecisions,
  getProjectAutonomousHealth,
  getProjectHumanApprovals,
  getCampaignEvidenceGraph,
  getProjectCampaigns,
  decideHumanApproval,
} from '@/services/db';
import {
  Activity,
  Shield,
  HelpCircle,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  GitBranch,
  ChevronRight,
  Sliders,
  ExternalLink,
} from 'lucide-react';

export default function AutonomousControlCenterPage() {
  const params = useParams();
  const { getToken, userId } = useAuth();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<AutonomousEvent[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [approvals, setApprovals] = useState<HumanApprovalRecord[]>([]);
  const [health, setHealth] = useState<AutonomousHealthMetrics | null>(null);
  const [evidenceGraph, setEvidenceGraph] = useState<EvidenceGraph>({ nodes: [], edges: [] });
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'DECISIONS' | 'EVIDENCE' | 'APPROVALS'>('TIMELINE');

  // Live Auto-Refresh (every 5 seconds)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      else setRefreshing(true);

      const token = await getToken();
      const effectiveToken = token || '';

      const [proj, evts, decs, apprs, hlt, camps] = await Promise.all([
        getProject(effectiveToken, projectId),
        getProjectAutonomousEvents(effectiveToken, projectId, 100),
        getProjectAutonomousDecisions(effectiveToken, projectId, 50),
        getProjectHumanApprovals(effectiveToken, projectId),
        getProjectAutonomousHealth(effectiveToken, projectId),
        getProjectCampaigns(effectiveToken, projectId),
      ]);

      setProject(proj);
      setEvents(evts || []);
      setDecisions(decs || []);
      setApprovals(apprs || []);
      setHealth(hlt || null);
      setError(null);

      const runningCamp = camps.find((c) => c.status === 'RUNNING') || camps[0] || null;
      setActiveCampaign(runningCamp);

      if (runningCamp) {
        const graph = await getCampaignEvidenceGraph(effectiveToken, runningCamp.id);
        if (graph && graph.nodes.length > 0) {
          setEvidenceGraph(graph);
        } else {
          setEvidenceGraph({ nodes: [], edges: [] });
        }
      } else {
        setEvidenceGraph({ nodes: [], edges: [] });
      }
    } catch (err: any) {
      console.error('[Control Center Error]:', err);
      setError(err?.message || 'Failed loading autonomous control center data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 5-second polling interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleDecideApproval = async (
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string
  ) => {
    const token = await getToken();
    const effectiveToken = token || '';
    const effectiveUser = userId || 'Operator';

    await decideHumanApproval(
      effectiveToken,
      approvalId,
      decision,
      reason,
      effectiveUser
    );

    // Refresh approvals list
    const updated = await getProjectHumanApprovals(effectiveToken, projectId);
    setApprovals(updated || []);
  };

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-6 pb-12">
      {error && (
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadData(false)}
            className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 font-semibold"
          >
            Retry
          </button>
        </div>
      )}
      {/* Page Breadcrumb & Header */}
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
            <span className="text-zinc-300 font-medium">Autonomous Control Center</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-400" />
            Autonomous QA Control Center
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Real-time observability, explainable AI reasoning, causal evidence chains, and human-in-the-loop control.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Live Polling Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              autoRefresh
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-blue-400 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            {autoRefresh ? 'Live Polling (5s)' : 'Polling Paused'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => loadData(false)}
            disabled={loading || refreshing}
            className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Direct link to approvals */}
          <Link
            href={`/projects/${projectId}/autonomous/approvals`}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              pendingApprovalsCount > 0
                ? 'bg-amber-500 text-black border-amber-400 hover:bg-amber-400'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Human Approvals
            {pendingApprovalsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-black/20 text-black font-bold rounded-full text-[10px]">
                {pendingApprovalsCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Top Split: What is Sculra Doing & Autonomous Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <WhatSculraIsDoingCard
          projectId={projectId}
          activeCampaign={activeCampaign}
          lastEvent={events[0] || null}
          pendingApprovals={approvals.filter((a) => a.status === 'PENDING')}
          className="lg:col-span-1"
        />

        {health && (
          <AutonomousHealthPanel
            metrics={health}
            onRefresh={() => loadData(true)}
            isRefreshing={refreshing}
            className="lg:col-span-2"
          />
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-800">
        <nav className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('TIMELINE')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'TIMELINE'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Live Event Stream
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {events.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DECISIONS')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'DECISIONS'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Explainable Decisions &quot;Why&quot;
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {decisions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('EVIDENCE')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'EVIDENCE'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Causal Evidence Graph
            <span className="text-xs px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              {evidenceGraph.nodes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === 'APPROVALS'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Human Approvals
            {pendingApprovalsCount > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold font-mono">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'TIMELINE' && (
          <AutonomousTimeline
            events={events}
            onRefresh={() => loadData(true)}
            isRefreshing={refreshing}
          />
        )}

        {activeTab === 'DECISIONS' && (
          <DecisionExplorer decisions={decisions} />
        )}

        {activeTab === 'EVIDENCE' && (
          <EvidenceGraphViewer graph={evidenceGraph} />
        )}

        {activeTab === 'APPROVALS' && (
          <HumanApprovalsPanel
            approvals={approvals}
            onDecide={handleDecideApproval}
          />
        )}
      </div>
    </div>
  );
}
