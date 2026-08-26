'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Stack, Flex, Grid } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { createProject } from '@/services/db';

type SourceType = 'website' | 'github' | 'zip' | 'desktop' | 'api';

const steps = [
  { id: 1, title: 'Source' },
  { id: 2, title: 'Configuration' },
  { id: 3, title: 'Review' },
  { id: 4, title: 'Connected' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const { getToken, orgId, userId } = useAuth();

  const [currentStep, setCurrentStep] = React.useState(1);
  const [selectedSource, setSelectedSource] = React.useState<SourceType>('website');

  // Form states
  const [projectName, setProjectName] = React.useState('');
  const [targetUrl, setTargetUrl] = React.useState('');
  const [branchName, setBranchName] = React.useState('main');
  const [environment, setEnvironment] = React.useState('Staging');

  // Validation states
  const [errorMsg, setErrorMsg] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdProjectId, setCreatedProjectId] = React.useState('');

  const sourcesList = [
    {
      id: 'website' as SourceType,
      title: 'Website URL',
      description: 'Test any public website URL or hosted application environment.',
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      active: true,
      status: 'Active',
    },
    {
      id: 'github' as SourceType,
      title: 'GitHub Repository',
      description: 'Connect a repository target. Run sweeps on PR builds or push events.',
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      ),
      active: true,
      status: 'Active',
    },
    {
      id: 'zip' as SourceType,
      title: 'ZIP / Project Folder',
      description: 'Upload a compressed folder bundle of application assets.',
      icon: (
        <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      active: false,
      status: 'Coming Soon',
    },
    {
      id: 'desktop' as SourceType,
      title: 'Desktop Executable',
      description: 'Verify desktop apps by uploading compiled installer targets.',
      icon: (
        <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      active: false,
      status: 'Coming Soon',
    },
    {
      id: 'api' as SourceType,
      title: 'API Testing Endpoint',
      description: 'Execute API conformance and compliance checks against routes.',
      icon: (
        <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
      active: false,
      status: 'Coming Soon',
    },
  ];

  // Validation functions
  const validateWebsiteUrl = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'Website target URL must start with http:// or https://';
    }
    try {
      new URL(url);
      return '';
    } catch {
      return 'Invalid URL format. Please check the spelling and try again.';
    }
  };

  const validateGitHubUrl = (url: string) => {
    const gitHubRegex = /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git)$/;
    if (!gitHubRegex.test(url)) {
      return 'Must be a valid GitHub repository URL (e.g. https://github.com/company/project)';
    }
    return '';
  };

  const handleNextStep = () => {
    setErrorMsg('');
    if (currentStep === 1) {
      const sourceConfig = sourcesList.find((s) => s.id === selectedSource);
      if (!sourceConfig?.active) {
        setErrorMsg('The selected source option is coming soon. Please choose Website URL or GitHub Repository.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!projectName.trim()) {
        setErrorMsg('Project Name is required.');
        return;
      }
      if (selectedSource === 'website') {
        const error = validateWebsiteUrl(targetUrl);
        if (error) {
          setErrorMsg(error);
          return;
        }
      } else if (selectedSource === 'github') {
        const error = validateGitHubUrl(targetUrl);
        if (error) {
          setErrorMsg(error);
          return;
        }
      }
      setCurrentStep(3);
    }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim() || !userId) return;
    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const token = await getToken();
      if (token) {
        const project = await createProject(token, {
          name: projectName,
          type: selectedSource,
          url: selectedSource === 'website' ? targetUrl : undefined,
          repoUrl: selectedSource === 'github' ? targetUrl : undefined,
          clerkOrgId: orgId,
          clerkUserId: userId,
          environment,
          branch: selectedSource === 'github' ? branchName : undefined,
        });

        setCreatedProjectId(project.id);
        setCurrentStep(4);
      }
    } catch (e) {
      console.error('[Project creation failed]', e);
      setErrorMsg('Failed saving project target. Verify database configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack spacing={24} className="max-w-2xl mx-auto py-8">
      {/* Progress header timeline bar */}
      <div className="flex justify-between items-center relative pb-6 border-b border-white/5 select-none">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-900 -translate-y-1/2 -z-10" />
        {steps.map((step) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center gap-2 bg-zinc-950 px-3 z-10">
              <span className={`h-5 w-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold border ${
                isActive ? 'border-accent text-accent' : isCompleted ? 'border-success text-success' : 'border-zinc-800 text-muted-foreground'
              }`}>
                {step.id}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                isActive ? 'text-accent' : isCompleted ? 'text-success' : 'text-muted-foreground'
              }`}>
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {errorMsg && (
        <div className="p-3 border border-danger/20 bg-danger/5 text-danger text-xs font-semibold rounded font-mono">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Multi-step Animation container */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <Stack spacing={16}>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Connect an application</h2>
                  <p className="text-xs text-muted-foreground mt-1">Choose how you want Sculra to access the application you want to test.</p>
                </div>

                <div className="grid gap-3 grid-cols-1">
                  {sourcesList.map((src) => (
                    <div
                      key={src.id}
                      onClick={() => src.active && setSelectedSource(src.id)}
                      className={`flex items-start gap-4 p-4 border rounded-xl transition-all select-none cursor-pointer ${
                        !src.active
                          ? 'opacity-40 cursor-not-allowed border-white/5 bg-zinc-900/10'
                          : selectedSource === src.id
                          ? 'border-accent bg-accent/5'
                          : 'border-white/5 bg-zinc-900/20 hover:border-white/10'
                      }`}
                    >
                      <div className="p-2 border border-white/5 rounded-lg bg-zinc-950 shrink-0">
                        {src.icon}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-xs font-bold text-foreground">{src.title}</span>
                          <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${
                            src.active ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-zinc-900 border-zinc-800 text-muted-foreground'
                          }`}>
                            {src.status}
                          </span>
                        </div>
                        <p className="text-3xs text-muted-foreground leading-relaxed">{src.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Flex justify="end" className="pt-4">
                  <Button variant="accent" size="sm" onClick={handleNextStep}>
                    Continue
                  </Button>
                </Flex>
              </Stack>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <Stack spacing={20}>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Configure application details</h2>
                  <p className="text-xs text-muted-foreground mt-1">Specify parameters for the connected target repository or hosted instance.</p>
                </div>

                <Stack spacing={16} className="bg-zinc-900/20 border border-white/5 p-6 rounded-xl">
                  {/* Common: Project Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Project Name</label>
                    <Input
                      placeholder="e.g. My SaaS Product"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>

                  {selectedSource === 'website' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Website URL</label>
                        <Input
                          placeholder="https://staging.example.com"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Environment Scope</label>
                        <Select
                          value={environment}
                          onChange={(e) => setEnvironment(e.target.value)}
                          options={[
                            { label: 'Staging Environment (Default)', value: 'Staging' },
                            { label: 'Development Sandbox', value: 'Development' },
                            { label: 'Production Instance', value: 'Production' },
                          ]}
                        />
                      </div>

                      {/* Authentication setup helper block */}
                      <div className="p-4 border border-accent/10 bg-accent/5 rounded-lg space-y-1 font-mono text-[10px]">
                        <span className="text-accent font-bold uppercase block tracking-wider">🔒 Authentication setup</span>
                        <p className="text-muted-foreground leading-normal">
                          Protected application access (login username/password parameters) will be configured securely after project creation.
                        </p>
                      </div>
                    </>
                  )}

                  {selectedSource === 'github' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Repository URL</label>
                        <Input
                          placeholder="https://github.com/company/project"
                          value={targetUrl}
                          onChange={(e) => setTargetUrl(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Target Branch</label>
                        <Input
                          placeholder="main"
                          value={branchName}
                          onChange={(e) => setBranchName(e.target.value)}
                        />
                      </div>

                      {/* Github integration block */}
                      <div className="p-4 border border-white/5 bg-zinc-900/30 rounded-lg space-y-1 font-mono text-[10px]">
                        <span className="text-foreground font-bold block">🐙 GitHub OAuth Integration</span>
                        <p className="text-muted-foreground leading-normal">
                          GitHub connection will be completed in the next integration step. Project configs can be saved if URL is verified.
                        </p>
                      </div>
                    </>
                  )}
                </Stack>

                <Flex justify="between" className="pt-4">
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(1)}>
                    Back
                  </Button>
                  <Button variant="accent" size="sm" onClick={handleNextStep}>
                    Continue
                  </Button>
                </Flex>
              </Stack>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <Stack spacing={20}>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Confirm connection details</h2>
                  <p className="text-xs text-muted-foreground mt-1">Verify entered project parameters before registering targets.</p>
                </div>

                <div className="bg-zinc-900/20 border border-white/5 p-6 rounded-xl space-y-4 font-mono text-xs">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Project Name</span>
                    <span className="text-foreground font-semibold">{projectName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Source Type</span>
                    <span className="text-accent uppercase font-bold">{selectedSource}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Target URL</span>
                    <span className="text-foreground truncate max-w-[300px]">{targetUrl}</span>
                  </div>
                  {selectedSource === 'github' && (
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-muted-foreground">Branch</span>
                      <span className="text-foreground font-semibold">{branchName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment</span>
                    <span className="text-foreground font-semibold">{environment}</span>
                  </div>
                </div>

                <Flex justify="between" className="pt-4">
                  <Button variant="outline" size="sm" onClick={() => setCurrentStep(2)} disabled={isSubmitting}>
                    Back
                  </Button>
                  <Button variant="accent" size="sm" onClick={handleCreateProject} disabled={isSubmitting}>
                    {isSubmitting ? 'Registering Target...' : 'Confirm & Save'}
                  </Button>
                </Flex>
              </Stack>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
            >
              <div className="border border-white/5 bg-zinc-950/20 rounded-2xl p-12 text-center space-y-6 shadow-glass max-w-lg mx-auto">
                <div className="h-10 w-10 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto text-success text-lg font-bold">
                  ✓
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-extrabold text-foreground">Project Target Connected</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    "{projectName}" has been registered successfully. QA agents can now target this endpoint for automated regression runs.
                  </p>
                </div>

                <div className="bg-zinc-900/40 border border-white/5 p-4 rounded-xl text-left font-mono text-[10px] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-success font-bold uppercase tracking-wider">Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment</span>
                    <span className="text-foreground font-semibold">{environment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Test Readiness</span>
                    <span className="text-accent font-semibold">
                      {selectedSource === 'website' ? 'Ready to test' : 'Connection pending'}
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button variant="accent" onClick={() => router.push(`/projects/${createdProjectId}`)}>
                    Open Project details
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Stack>
  );
}
