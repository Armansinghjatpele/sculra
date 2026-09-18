'use client';

// ==============================================================================
// Sculra Syntax-Colored Unified & Structured Diff Viewer
// (frontend/components/DiffViewer.tsx)
// ==============================================================================

import * as React from 'react';
import { StructuredPatch } from '@/lib/demoData';
import { Copy, Check, FileCode, Plus, Minus } from 'lucide-react';

interface DiffViewerProps {
  diff?: string;
  structuredPatch?: StructuredPatch;
  maxHeight?: string;
  className?: string;
}

// Redact any accidentally exposed secrets or authorization keys
function maskDiffSecrets(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/(ghp_[A-Za-z0-9]{20,})/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(gho_[A-Za-z0-9]{20,})/g, '[REDACTED_OAUTH_TOKEN]')
    .replace(/(sk-[A-Za-z0-9_-]{20,})/g, '[REDACTED_API_KEY]')
    .replace(/(AKIA[0-9A-Z]{16})/g, '[REDACTED_AWS_KEY]')
    .replace(/(bearer\s+[A-Za-z0-9\-._~+/]+=*)/gi, 'Bearer [REDACTED_BEARER_TOKEN]');
}

export function DiffViewer({
  diff,
  structuredPatch,
  maxHeight = '400px',
  className = '',
}: DiffViewerProps) {
  const [copied, setCopied] = React.useState(false);

  // Generate unified diff text if not provided but structuredPatch exists
  const rawContent = React.useMemo(() => {
    if (diff) return diff;
    if (!structuredPatch?.edits || structuredPatch.edits.length === 0) return '';

    return structuredPatch.edits
      .map((edit) => {
        const header = `--- a/${edit.filePath}\n+++ b/${edit.filePath}\n`;
        if (edit.action === 'CREATE') {
          const added = (edit.replacementCode || '')
            .split('\n')
            .map((l) => `+ ${l}`)
            .join('\n');
          return `${header}@@ -0,0 +1,${(edit.replacementCode || '').split('\n').length} @@\n${added}`;
        }
        if (edit.action === 'DELETE') {
          const removed = (edit.originalCode || '')
            .split('\n')
            .map((l) => `- ${l}`)
            .join('\n');
          return `${header}@@ -1,${(edit.originalCode || '').split('\n').length} +0,0 @@\n${removed}`;
        }
        // MODIFY
        const before = edit.contextBefore ? `${edit.contextBefore}\n` : '';
        const removed = (edit.originalCode || '')
          .split('\n')
          .map((l) => `- ${l}`)
          .join('\n');
        const added = (edit.replacementCode || '')
          .split('\n')
          .map((l) => `+ ${l}`)
          .join('\n');
        const after = edit.contextAfter ? `\n${edit.contextAfter}` : '';
        return `${header}@@ -1,1 +1,1 @@\n${before}${removed}\n${added}${after}`;
      })
      .join('\n\n');
  }, [diff, structuredPatch]);

  const sanitizedContent = React.useMemo(() => maskDiffSecrets(rawContent), [rawContent]);

  const lines = React.useMemo(() => {
    if (!sanitizedContent) return [];
    return sanitizedContent.split('\n');
  }, [sanitizedContent]);

  // Count additions and deletions
  const { additions, deletions } = React.useMemo(() => {
    if (structuredPatch) {
      return { additions: structuredPatch.additions, deletions: structuredPatch.deletions };
    }
    let add = 0;
    let del = 0;
    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) add++;
      if (l.startsWith('-') && !l.startsWith('---')) del++;
    }
    return { additions: add, deletions: del };
  }, [lines, structuredPatch]);

  const handleCopy = () => {
    if (!sanitizedContent) return;
    navigator.clipboard.writeText(sanitizedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!lines || lines.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-zinc-950/60 border border-white/5 text-center text-xs font-mono text-zinc-500">
        No code changes or diff generated.
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-zinc-950 overflow-hidden font-mono text-2xs ${className}`}>
      {/* Diff Header Bar */}
      <div className="px-3 py-2 bg-zinc-900/80 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-zinc-400">
            <FileCode className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-zinc-200">
              {structuredPatch?.filesChanged ?? 1} file{(structuredPatch?.filesChanged ?? 1) > 1 ? 's' : ''} changed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-0.5 text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 text-3xs font-bold">
              <Plus className="w-2.5 h-2.5" /> {additions}
            </span>
            <span className="inline-flex items-center gap-0.5 text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40 text-3xs font-bold">
              <Minus className="w-2.5 h-2.5" /> {deletions}
            </span>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-3xs border border-white/5 cursor-pointer"
          title="Copy diff to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Diff Content View */}
      <div
        className="overflow-x-auto overflow-y-auto p-3 space-y-0.5"
        style={{ maxHeight }}
      >
        {lines.map((line, idx) => {
          let lineClass = 'text-zinc-400';
          let bgClass = '';

          if (line.startsWith('+++') || line.startsWith('---')) {
            lineClass = 'text-zinc-300 font-bold';
            bgClass = 'bg-zinc-900/60 px-1 py-0.5 rounded';
          } else if (line.startsWith('@@')) {
            lineClass = 'text-cyan-400 font-semibold';
            bgClass = 'bg-cyan-950/30 px-1 py-0.5 rounded border-l-2 border-cyan-500';
          } else if (line.startsWith('+')) {
            lineClass = 'text-emerald-300';
            bgClass = 'bg-emerald-950/40 px-1 py-0.5 rounded border-l-2 border-emerald-500';
          } else if (line.startsWith('-')) {
            lineClass = 'text-rose-300';
            bgClass = 'bg-rose-950/40 px-1 py-0.5 rounded border-l-2 border-rose-500';
          }

          return (
            <div
              key={idx}
              className={`flex items-start font-mono leading-relaxed whitespace-pre font-normal select-text ${bgClass}`}
            >
              <span className="w-8 select-none text-zinc-600 text-right pr-3 shrink-0 text-3xs">
                {idx + 1}
              </span>
              <span className={`break-all ${lineClass}`}>{line || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
