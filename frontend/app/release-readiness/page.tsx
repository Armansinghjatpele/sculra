'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { getProjects, getTestRuns, getLatestReleaseScore, getReleaseScore, getProjectReleaseHistory } from '@/services/db';
import { Project, TestRun, ReleaseScore, ReleaseBlocker } from '@/lib/demoData';

export default function ReleaseReadinessPage() {
  const { getToken, orgId } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [testRuns, setTestRuns] = React.useState<TestRun[]>([]);
  const [selectedTestRunId, setSelectedTestRunId] = React.useState<string>('');
  const [releaseScore, setReleaseScore] = React.useState<ReleaseScore | null>(null);
  const [historyScores, setHistoryScores] = React.useState<ReleaseScore[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'breakdown' | 'blockers' | 'ai-analysis' | 'coverage'>('overview');
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>('functional');

  // Load Projects on mount
  React.useEffect(() => {
    async function loadProjectsData() {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const projs = await getProjects(token, orgId);
          setProjects(projs);
          if (projs.length > 0) {
            setSelectedProjectId(projs[0].id);
          }
        }
      } catch (err) {
        console.error('[Release Readiness]: Failed loading projects:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProjectsData();
  }, [getToken, orgId]);

  // Load Test Runs and Latest Score when selectedProjectId changes
  React.useEffect(() => {
    if (!selectedProjectId) return;
    async function loadProjectData() {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const runs = await getTestRuns(token, selectedProjectId);
          setTestRuns(runs);
          const history = await getProjectReleaseHistory(token, selectedProjectId);
          setHistoryScores(history);

          if (runs.length > 0) {
            const firstRunId = runs[0].id;
            setSelectedTestRunId(firstRunId);
            const score = await getReleaseScore(token, firstRunId);
            setReleaseScore(score);
          } else {
            const latest = await getLatestReleaseScore(token, selectedProjectId);
            setReleaseScore(latest);
          }
        }
      } catch (err) {
        console.error('[Release Readiness]: Failed loading release data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProjectData();
  }, [selectedProjectId, getToken]);

  // Load specific test run score when selectedTestRunId changes
  const handleTestRunChange = async (runId: string) => {
    setSelectedTestRunId(runId);
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const score = await getReleaseScore(token, runId);
        setReleaseScore(score);
      }
    } catch (err) {
      console.error('[Release Readiness]: Failed loading test run score:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  // Badge helpers
  const getRecommendationBadge = (rec?: string) => {
    switch (rec) {
      case 'RELEASE':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🟢 Release Recommended</span>;
      case 'RELEASE_WITH_CAUTION':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">🟡 Release with Caution</span>;
      case 'INSUFFICIENT_EVIDENCE':
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">⚪ Insufficient Evidence</span>;
      case 'DO_NOT_RELEASE':
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">🔴 Do Not Release</span>;
    }
  };

  const getRiskBadge = (risk?: string) => {
    switch (risk) {
      case 'CRITICAL':
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">Critical Risk</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">High Risk</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">Medium Risk</span>;
      case 'LOW':
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Low Risk</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">Unknown Risk</span>;
    }
  };

  const getConfidenceBadge = (conf?: string) => {
    switch (conf) {
      case 'HIGH':
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">High Confidence</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">Medium Confidence</span>;
      case 'LOW':
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">Low Confidence</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Insufficient</span>;
    }
  };

  const bd = releaseScore?.breakdown;
  const hist = bd?.historicalComparison;

  return (
    <AppShell>
      <Stack spacing={24} className="max-w-7xl mx-auto w-full pb-16">
        {/* Header & Selectors */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Release Readiness Assessment</h1>
              <span className="text-4xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                v{releaseScore?.scoringVersion || '1.0'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deterministic stability scoring, category breakdowns, blockers, and AI risk analysis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Project Selector */}
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Project:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-950 text-foreground">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Test Run Selector */}
            {testRuns.length > 0 && (
              <div className="flex items-center gap-2 bg-zinc-900/80 border border-white/10 rounded-xl px-3 py-1.5">
                <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Test Run:</span>
                <select
                  value={selectedTestRunId}
                  onChange={(e) => handleTestRunChange(e.target.value)}
                  className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
                >
                  {testRuns.map((r, idx) => (
                    <option key={r.id} value={r.id} className="bg-zinc-950 text-foreground">
                      {idx === 0 ? `Latest (${r.id.substring(0, 8)})` : `${r.id.substring(0, 8)} - ${r.createdAt}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedTestRunId && (
              <Link href={`/test-runs/${selectedTestRunId}`}>
                <Button variant="secondary" size="sm" className="text-xs">
                  Inspect Test Run ↗
                </Button>
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs text-muted-foreground">
            Calculating release readiness assessment from test evidence...
          </div>
        ) : !releaseScore ? (
          <Card className="glass-panel p-12 text-center border-dashed border-white/10 my-8">
            <div className="space-y-3 max-w-md mx-auto">
              <div className="text-3xl">📊</div>
              <h3 className="text-sm font-semibold text-foreground">No Release Assessment Available</h3>
              <p className="text-xs text-muted-foreground">
                Run an automated test against {currentProject?.name || 'this project'} to generate a deterministic release readiness score.
              </p>
              <div className="pt-2">
                <Link href={`/test-runs`}>
                  <Button variant="accent" size="sm">
                    Start Test Run
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {/* Hero Release Readiness Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-6 md:p-8 shadow-glass">
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                {/* Score Dial & Recommendation */}
                <div className="lg:col-span-4 flex flex-col items-center justify-center text-center border-b lg:border-b-0 lg:border-r border-white/5 pb-6 lg:pb-0 lg:pr-8">
                  <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-zinc-950 border-4 border-white/10 shadow-inner">
                    <div
                      className={`text-5xl font-extrabold tracking-tight ${
                        releaseScore.overallScore >= 85
                          ? 'text-emerald-400'
                          : releaseScore.overallScore >= 70
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {releaseScore.overallScore}
                    </div>
                    <span className="absolute bottom-6 text-4xs font-bold text-muted-foreground uppercase tracking-widest">
                      / 100
                    </span>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div>{getRecommendationBadge(releaseScore.recommendation)}</div>
                    {hist?.change !== undefined && (
                      <p className="text-4xs font-mono font-semibold text-muted-foreground">
                        {hist.change >= 0 ? `+${hist.change}` : hist.change} pts vs previous run ({hist.previousScore}/100)
                      </p>
                    )}
                  </div>
                </div>

                {/* Status & Key Metrics */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-4xs font-bold uppercase tracking-widest text-muted-foreground">Release Status</span>
                      <h2 className="text-lg font-bold text-foreground mt-0.5">
                        {releaseScore.recommendation.replace(/_/g, ' ')}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      {getRiskBadge(releaseScore.riskLevel)}
                      {getConfidenceBadge(releaseScore.confidenceLevel)}
                    </div>
                  </div>

                  {/* Executive Explanation */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-muted-foreground leading-relaxed">
                    {releaseScore.aiAnalysis?.releaseExplanation ||
                      `Application achieved a release readiness score of ${releaseScore.overallScore}/100 with ${releaseScore.blockersCount} active release blockers.`}
                  </div>

                  {/* Quick Stat Pill Row */}
                  <div className={`grid grid-cols-2 ${typeof releaseScore.accessibilityScore === 'number' ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3`}>
                    <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5">
                      <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Blockers</span>
                      <p className={`text-base font-bold mt-0.5 ${releaseScore.blockersCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {releaseScore.blockersCount}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5">
                      <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Functional</span>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {releaseScore.functionalityScore} <span className="text-4xs text-muted-foreground font-normal">/100</span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5">
                      <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Visual</span>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {releaseScore.uiScore} <span className="text-4xs text-muted-foreground font-normal">/100</span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5">
                      <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Responsive</span>
                      <p className="text-base font-bold text-foreground mt-0.5">
                        {releaseScore.responsiveScore} <span className="text-4xs text-muted-foreground font-normal">/100</span>
                      </p>
                    </div>

                    {typeof releaseScore.accessibilityScore === 'number' && (
                      <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5">
                        <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Accessibility</span>
                        <p className="text-base font-bold text-sky-400 mt-0.5">
                          {releaseScore.accessibilityScore} <span className="text-4xs text-muted-foreground font-normal">/100</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'overview' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Category Scores
              </button>
              <button
                onClick={() => setActiveTab('blockers')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeTab === 'blockers' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Release Blockers
                {releaseScore.blockersCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-4xs font-bold bg-rose-500/20 text-rose-400">
                    {releaseScore.blockersCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('ai-analysis')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'ai-analysis' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                AI Risk Analysis
              </button>
              <button
                onClick={() => setActiveTab('coverage')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'coverage' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Structural Coverage
              </button>
            </div>

            {/* TAB CONTENT: Overview & Category Scores */}
            {activeTab === 'overview' && (
              <Stack spacing={16}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Functional */}
                  <Card className="glass-panel p-4 cursor-pointer hover:border-white/20 transition-all" onClick={() => setExpandedCategory('functional')}>
                    <div className="flex items-center justify-between">
                      <span className="text-4xs font-bold uppercase tracking-widest text-muted-foreground">Functional (35%)</span>
                      <span className="text-xs font-bold text-foreground">{releaseScore.functionalityScore}/100</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: `${releaseScore.functionalityScore}%` }} />
                    </div>
                    <p className="text-4xs text-muted-foreground mt-2">
                      {bd?.functional?.deductions?.length || 0} deduction(s) applied
                    </p>
                  </Card>

                  {/* Visual */}
                  <Card className="glass-panel p-4 cursor-pointer hover:border-white/20 transition-all" onClick={() => setExpandedCategory('visual')}>
                    <div className="flex items-center justify-between">
                      <span className="text-4xs font-bold uppercase tracking-widest text-muted-foreground">Visual (20%)</span>
                      <span className="text-xs font-bold text-foreground">{releaseScore.uiScore}/100</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${releaseScore.uiScore}%` }} />
                    </div>
                    <p className="text-4xs text-muted-foreground mt-2">
                      {bd?.visual?.regressionsCount || 0} regression(s) detected
                    </p>
                  </Card>

                  {/* Responsive */}
                  <Card className="glass-panel p-4 cursor-pointer hover:border-white/20 transition-all" onClick={() => setExpandedCategory('responsive')}>
                    <div className="flex items-center justify-between">
                      <span className="text-4xs font-bold uppercase tracking-widest text-muted-foreground">Responsive (20%)</span>
                      <span className="text-xs font-bold text-foreground">{releaseScore.responsiveScore}/100</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${releaseScore.responsiveScore}%` }} />
                    </div>
                    <p className="text-4xs text-muted-foreground mt-2">
                      {bd?.responsive?.overflowCount || 0} overflow defect(s)
                    </p>
                  </Card>

                  {/* Reliability */}
                  <Card className="glass-panel p-4 cursor-pointer hover:border-white/20 transition-all" onClick={() => setExpandedCategory('reliability')}>
                    <div className="flex items-center justify-between">
                      <span className="text-4xs font-bold uppercase tracking-widest text-muted-foreground">Reliability (10%)</span>
                      <span className="text-xs font-bold text-foreground">{releaseScore.reliabilityScore}/100</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${releaseScore.reliabilityScore}%` }} />
                    </div>
                    <p className="text-4xs text-muted-foreground mt-2">
                      {bd?.reliability?.consoleErrorsCount || 0} console error(s)
                    </p>
                  </Card>

                  {/* Coverage */}
                  <Card className="glass-panel p-4 cursor-pointer hover:border-white/20 transition-all" onClick={() => setExpandedCategory('coverage')}>
                    <div className="flex items-center justify-between">
                      <span className="text-4xs font-bold uppercase tracking-widest text-muted-foreground">Coverage (15%)</span>
                      <span className="text-xs font-bold text-foreground">{releaseScore.coverageScore}/100</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: `${releaseScore.coverageScore}%` }} />
                    </div>
                    <p className="text-4xs text-muted-foreground mt-2">
                      {bd?.coverage?.pages?.visited || 0}/{bd?.coverage?.pages?.discovered || 0} pages visited
                    </p>
                  </Card>

                  {/* Accessibility */}
                  {typeof releaseScore.accessibilityScore === 'number' && (
                    <Card className="glass-panel p-4 cursor-pointer hover:border-white/20 transition-all" onClick={() => setExpandedCategory('accessibility')}>
                      <div className="flex items-center justify-between">
                        <span className="text-4xs font-bold uppercase tracking-widest text-muted-foreground">Accessibility (10%)</span>
                        <span className="text-xs font-bold text-foreground">{releaseScore.accessibilityScore}/100</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            releaseScore.accessibilityScore >= 85 ? 'bg-emerald-500' : releaseScore.accessibilityScore >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${releaseScore.accessibilityScore}%` }}
                        />
                      </div>
                      <p className="text-4xs text-muted-foreground mt-2">
                        {bd?.accessibility?.deductions?.length || 0} deduction(s) applied
                      </p>
                    </Card>
                  )}
                </div>

                {/* Category Detail Breakdown Card */}
                {expandedCategory && bd && (
                  <Card className="glass-panel p-6">
                    <CardHeader className="p-0 mb-4 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
                          {expandedCategory} Score Breakdown
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          Base score is 100 points. Points deducted based on deterministic failure telemetry.
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {expandedCategory === 'functional' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                            <span className="font-semibold text-foreground">Base Score</span>
                            <span className="font-mono text-emerald-400 font-bold">100 pts</span>
                          </div>
                          {bd.functional.deductions.map((d: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/[0.03] border border-rose-500/10 text-xs">
                              <span className="text-muted-foreground">{d.reason}</span>
                              <span className="font-mono text-rose-400 font-bold">-{d.points} pts</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs font-bold">
                            <span className="text-foreground">Final Functional Score</span>
                            <span className="font-mono text-brand-400">{bd.functional.final} / 100</span>
                          </div>
                        </div>
                      )}

                      {expandedCategory === 'visual' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                            <span className="font-semibold text-foreground">Base Score</span>
                            <span className="font-mono text-emerald-400 font-bold">100 pts</span>
                          </div>
                          {bd.visual.deductions.map((d: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/[0.03] border border-rose-500/10 text-xs">
                              <span className="text-muted-foreground">{d.reason}</span>
                              <span className="font-mono text-rose-400 font-bold">-{d.points} pts</span>
                            </div>
                          ))}
                          {bd.visual.missingBaselinesCount > 0 && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/[0.03] border border-blue-500/10 text-xs">
                              <span className="text-muted-foreground">{bd.visual.missingBaselinesCount} initial baseline(s) established (no regression penalty)</span>
                              <span className="font-mono text-blue-400 font-bold">0 pts</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs font-bold">
                            <span className="text-foreground">Final Visual Score</span>
                            <span className="font-mono text-blue-400">{bd.visual.final} / 100</span>
                          </div>
                        </div>
                      )}

                      {expandedCategory === 'responsive' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                            <span className="font-semibold text-foreground">Base Score</span>
                            <span className="font-mono text-emerald-400 font-bold">100 pts</span>
                          </div>
                          {bd.responsive.deductions.map((d: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/[0.03] border border-rose-500/10 text-xs">
                              <span className="text-muted-foreground">{d.reason}</span>
                              <span className="font-mono text-rose-400 font-bold">-{d.points} pts</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs font-bold">
                            <span className="text-foreground">Final Responsive Score</span>
                            <span className="font-mono text-purple-400">{bd.responsive.final} / 100</span>
                          </div>
                        </div>
                      )}

                      {expandedCategory === 'reliability' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                            <span className="font-semibold text-foreground">Base Score</span>
                            <span className="font-mono text-emerald-400 font-bold">100 pts</span>
                          </div>
                          {bd.reliability.deductions.map((d: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/[0.03] border border-rose-500/10 text-xs">
                              <span className="text-muted-foreground">{d.reason}</span>
                              <span className="font-mono text-rose-400 font-bold">-{d.points} pts</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs font-bold">
                            <span className="text-foreground">Final Reliability Score</span>
                            <span className="font-mono text-emerald-400">{bd.reliability.final} / 100</span>
                          </div>
                        </div>
                      )}

                      {expandedCategory === 'coverage' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs space-y-2">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pages Visited Ratio (35%)</span>
                              <span className="font-mono text-foreground">{bd.coverage.pages.visited} / {bd.coverage.pages.discovered}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Forms Exercised Ratio (20%)</span>
                              <span className="font-mono text-foreground">{bd.coverage.forms.exercised} / {bd.coverage.forms.discovered}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Buttons Tested Ratio (15%)</span>
                              <span className="font-mono text-foreground">{bd.coverage.buttons.exercised} / {bd.coverage.buttons.discovered}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Navigation Links Ratio (15%)</span>
                              <span className="font-mono text-foreground">{bd.coverage.links.exercised} / {bd.coverage.links.discovered}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Viewport Profiles Matrix (15%)</span>
                              <span className="font-mono text-foreground">{bd.coverage.viewports.tested} / 3</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs font-bold">
                            <span className="text-foreground">Final Coverage Score</span>
                            <span className="font-mono text-amber-400">{bd.coverage.final} / 100</span>
                          </div>
                        </div>
                      )}

                      {expandedCategory === 'accessibility' && bd.accessibility && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
                            <span className="font-semibold text-foreground">Base Score</span>
                            <span className="font-mono text-emerald-400 font-bold">100 pts</span>
                          </div>
                          {bd.accessibility.deductions.map((d: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-rose-500/[0.03] border border-rose-500/10 text-xs">
                              <span className="text-muted-foreground">{d.reason}</span>
                              <span className="font-mono text-rose-400 font-bold">-{d.points} pts</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs font-bold">
                            <span className="text-foreground">Final Accessibility Score</span>
                            <span className="font-mono text-sky-400">{bd.accessibility.final} / 100</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Stack>
            )}

            {/* TAB CONTENT: Release Blockers */}
            {activeTab === 'blockers' && (
              <Stack spacing={16}>
                {releaseScore.blockers && releaseScore.blockers.length > 0 ? (
                  releaseScore.blockers.map((blocker: ReleaseBlocker) => (
                    <Card key={blocker.id} className="glass-panel p-6 border-l-4 border-l-rose-500">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-4xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              {blocker.severity} blocker
                            </span>
                            <span className="text-4xs font-mono uppercase text-muted-foreground">
                              {blocker.category}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-foreground">{blocker.title}</h3>
                          <p className="text-xs text-rose-300/90 font-medium">Why Blocked: {blocker.reason}</p>
                          <p className="text-xs text-muted-foreground">Evidence: {blocker.evidenceSummary}</p>
                        </div>
                        {blocker.relatedIssueFingerprints && blocker.relatedIssueFingerprints.length > 0 && (
                          <Link href={`/issues`}>
                            <Button variant="secondary" size="sm" className="text-xs shrink-0">
                              View Issue ↗
                            </Button>
                          </Link>
                        )}
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="glass-panel p-10 text-center">
                    <div className="space-y-2">
                      <div className="text-2xl">✅</div>
                      <h3 className="text-sm font-semibold text-foreground">Zero Active Release Blockers</h3>
                      <p className="text-xs text-muted-foreground">
                        No open critical functional bugs or systemic mobile layout failures detected.
                      </p>
                    </div>
                  </Card>
                )}
              </Stack>
            )}

            {/* TAB CONTENT: AI Risk Analysis */}
            {activeTab === 'ai-analysis' && (
              <Stack spacing={16}>
                {releaseScore.aiAnalysis ? (
                  <div className="space-y-6">
                    {/* Executive Summary */}
                    <Card className="glass-panel p-6">
                      <CardHeader className="p-0 mb-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-brand-400">
                          Executive Narrative
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 text-xs text-muted-foreground leading-relaxed">
                        {releaseScore.aiAnalysis.summary}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Key Risks */}
                      <Card className="glass-panel p-6 border-l-4 border-l-rose-500">
                        <CardHeader className="p-0 mb-3">
                          <CardTitle className="text-xs font-bold uppercase tracking-widest text-rose-400">
                            Key Risks & Concerns
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-2 text-xs text-muted-foreground">
                          {releaseScore.aiAnalysis.keyRisks.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-rose-400 mt-0.5">•</span>
                              <span>{risk}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      {/* Validated Strengths */}
                      <Card className="glass-panel p-6 border-l-4 border-l-emerald-500">
                        <CardHeader className="p-0 mb-3">
                          <CardTitle className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                            Validated Strengths
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-2 text-xs text-muted-foreground">
                          {releaseScore.aiAnalysis.strengths.map((str, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-emerald-400 mt-0.5">•</span>
                              <span>{str}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Evidence Gaps & Next Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="glass-panel p-6">
                        <CardHeader className="p-0 mb-3">
                          <CardTitle className="text-xs font-bold uppercase tracking-widest text-amber-400">
                            Evidence Gaps
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-2 text-xs text-muted-foreground">
                          {releaseScore.aiAnalysis.evidenceGaps.map((gap, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">•</span>
                              <span>{gap}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="glass-panel p-6">
                        <CardHeader className="p-0 mb-3">
                          <CardTitle className="text-xs font-bold uppercase tracking-widest text-blue-400">
                            Recommended Next Actions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 space-y-2 text-xs text-muted-foreground">
                          {releaseScore.aiAnalysis.recommendedActions.map((act, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-blue-400 mt-0.5 font-bold">{i + 1}.</span>
                              <span>{act}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <Card className="glass-panel p-8 text-center">
                    <p className="text-xs text-muted-foreground">AI release analysis is not available for this run.</p>
                  </Card>
                )}
              </Stack>
            )}

            {/* TAB CONTENT: Coverage */}
            {activeTab === 'coverage' && bd && (
              <Stack spacing={16}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="glass-panel p-5 text-center">
                    <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Pages Visited</span>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {bd.coverage.pages.visited} <span className="text-xs text-muted-foreground font-normal">/ {bd.coverage.pages.discovered}</span>
                    </p>
                    <p className="text-4xs text-brand-400 font-mono mt-1">
                      {(bd.coverage.pages.ratio * 100).toFixed(0)}% Discovered Surface
                    </p>
                  </Card>

                  <Card className="glass-panel p-5 text-center">
                    <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Forms Exercised</span>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {bd.coverage.forms.exercised} <span className="text-xs text-muted-foreground font-normal">/ {bd.coverage.forms.discovered}</span>
                    </p>
                    <p className="text-4xs text-blue-400 font-mono mt-1">
                      {(bd.coverage.forms.ratio * 100).toFixed(0)}% Form Surface
                    </p>
                  </Card>

                  <Card className="glass-panel p-5 text-center">
                    <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Buttons Tested</span>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {bd.coverage.buttons.exercised} <span className="text-xs text-muted-foreground font-normal">/ {bd.coverage.buttons.discovered}</span>
                    </p>
                    <p className="text-4xs text-purple-400 font-mono mt-1">
                      {(bd.coverage.buttons.ratio * 100).toFixed(0)}% Actionables
                    </p>
                  </Card>

                  <Card className="glass-panel p-5 text-center">
                    <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Links Traversed</span>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {bd.coverage.links.exercised} <span className="text-xs text-muted-foreground font-normal">/ {bd.coverage.links.discovered}</span>
                    </p>
                    <p className="text-4xs text-emerald-400 font-mono mt-1">
                      {(bd.coverage.links.ratio * 100).toFixed(0)}% Routing Links
                    </p>
                  </Card>

                  <Card className="glass-panel p-5 text-center">
                    <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">Viewports Matrix</span>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {bd.coverage.viewports.tested} <span className="text-xs text-muted-foreground font-normal">/ 3</span>
                    </p>
                    <p className="text-4xs text-amber-400 font-mono mt-1">
                      Desktop, Tablet, Mobile
                    </p>
                  </Card>
                </div>
              </Stack>
            )}

            {/* Historical Trend Table */}
            {historyScores.length > 1 && (
              <Card className="glass-panel p-6 mt-8">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Historical Release Scores Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-4xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2.5 pr-4">Test Run</th>
                          <th className="py-2.5 px-4">Evaluated At</th>
                          <th className="py-2.5 px-4">Score</th>
                          <th className="py-2.5 px-4">Recommendation</th>
                          <th className="py-2.5 px-4">Confidence</th>
                          <th className="py-2.5 pl-4">Blockers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-muted-foreground">
                        {historyScores.map((h) => (
                          <tr key={h.id} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 pr-4 font-mono font-bold text-foreground">
                              <Link href={`/test-runs/${h.testRunId}`} className="hover:underline">
                                {h.testRunId.substring(0, 8)} ↗
                              </Link>
                            </td>
                            <td className="py-2.5 px-4">{h.createdAt}</td>
                            <td className="py-2.5 px-4 font-bold text-foreground">{h.overallScore} / 100</td>
                            <td className="py-2.5 px-4">{getRecommendationBadge(h.recommendation)}</td>
                            <td className="py-2.5 px-4">{getConfidenceBadge(h.confidenceLevel)}</td>
                            <td className="py-2.5 pl-4 font-mono">{h.blockersCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Stack>
    </AppShell>
  );
}
