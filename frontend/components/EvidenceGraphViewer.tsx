'use client';

// ==============================================================================
// Sculra Evidence Graph Viewer Component (frontend/components/EvidenceGraphViewer.tsx)
// ==============================================================================

import React, { useState } from 'react';
import { EvidenceGraph, EvidenceNode } from '@/lib/demoData';
import { FACT_CATEGORY_CONFIG, CONFIDENCE_CONFIG } from './WhyExplanationCard';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  ExternalLink,
  Code,
  Shield,
  Clock,
  Sparkles,
  Eye,
  GitPullRequest,
  CheckSquare,
} from 'lucide-react';

interface EvidenceGraphViewerProps {
  graph: EvidenceGraph;
  className?: string;
}

export function EvidenceGraphViewer({ graph, className = '' }: EvidenceGraphViewerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    graph.nodes.length > 0 ? graph.nodes[0].id : null
  );

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId) || null;

  const getNodeIcon = (type: EvidenceNode['type']) => {
    switch (type) {
      case 'CAMPAIGN':
        return <Layers className="w-4 h-4 text-blue-400" />;
      case 'TASK':
        return <Clock className="w-4 h-4 text-purple-400" />;
      case 'TEST_RUN':
        return <PlaySquareIcon className="w-4 h-4 text-teal-400" />;
      case 'OBSERVATION':
      case 'EVIDENCE':
        return <Eye className="w-4 h-4 text-cyan-400" />;
      case 'ISSUE':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'RCA':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'FIX_PLAN':
      case 'PATCH':
        return <Code className="w-4 h-4 text-indigo-400" />;
      case 'VERIFICATION':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'APPROVAL':
        return <CheckSquare className="w-4 h-4 text-rose-400" />;
      case 'PR':
        return <GitPullRequest className="w-4 h-4 text-emerald-400" />;
      default:
        return <Info className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Visual Chain Progression */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 overflow-x-auto">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          Autonomous Evidence Lineage & Causal Chain
        </h3>

        <div className="flex items-center gap-2 min-w-max pb-2">
          {graph.nodes.map((node, index) => {
            const isSelected = selectedNodeId === node.id;
            const factConfig = FACT_CATEGORY_CONFIG[node.factCategory] || {
              label: node.factCategory,
              bg: 'bg-zinc-800',
              text: 'text-zinc-400',
              border: 'border-zinc-700',
            };

            return (
              <React.Fragment key={node.id}>
                {/* Node Box */}
                <button
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all max-w-[210px] ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500 shadow-md'
                      : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full mb-1.5">
                    {getNodeIcon(node.type)}
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      {node.type}
                    </span>
                    <span
                      className={`ml-auto text-[9px] font-semibold px-1 py-0.2 rounded border ${factConfig.bg} ${factConfig.text} ${factConfig.border}`}
                    >
                      {factConfig.label}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-zinc-200 line-clamp-1 w-full">
                    {node.label}
                  </p>

                  {node.description && (
                    <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                      {node.description}
                    </p>
                  )}

                  <div className="mt-2 text-[10px] text-zinc-500 font-mono">
                    {new Date(node.timestamp).toLocaleTimeString()}
                  </div>
                </button>

                {/* Edge Arrow */}
                {index < graph.nodes.length - 1 && (
                  <div className="flex items-center text-zinc-600 px-0.5">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-400 uppercase bg-zinc-800 px-2 py-0.5 rounded">
                  {selectedNode.type}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                    FACT_CATEGORY_CONFIG[selectedNode.factCategory]?.bg || 'bg-zinc-800'
                  } ${
                    FACT_CATEGORY_CONFIG[selectedNode.factCategory]?.text || 'text-zinc-400'
                  } ${
                    FACT_CATEGORY_CONFIG[selectedNode.factCategory]?.border || 'border-zinc-700'
                  }`}
                >
                  {FACT_CATEGORY_CONFIG[selectedNode.factCategory]?.label || selectedNode.factCategory}
                </span>
                {selectedNode.confidence && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      CONFIDENCE_CONFIG[selectedNode.confidence]?.bg || 'bg-zinc-800'
                    } ${
                      CONFIDENCE_CONFIG[selectedNode.confidence]?.text || 'text-zinc-400'
                    } ${
                      CONFIDENCE_CONFIG[selectedNode.confidence]?.border || 'border-zinc-700'
                    }`}
                  >
                    {CONFIDENCE_CONFIG[selectedNode.confidence]?.label}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-semibold text-zinc-100">
                {selectedNode.label}
              </h4>
            </div>

            <div className="text-xs text-zinc-500 font-mono">
              {new Date(selectedNode.timestamp).toLocaleString()}
            </div>
          </div>

          {selectedNode.description && (
            <p className="mt-2 text-xs text-zinc-300">
              {selectedNode.description}
            </p>
          )}

          {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800/60">
              <span className="text-xs font-semibold text-zinc-400 block mb-1">
                Node Properties:
              </span>
              <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-400 overflow-x-auto">
                {JSON.stringify(selectedNode.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaySquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}
