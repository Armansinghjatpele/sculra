// ==============================================================================
// Sculra Visual & Responsive QA Types (worker/src/visual/types.ts)
// ==============================================================================

import { CapturedScreenshot } from '../types';

export type ViewportName = 'desktop' | 'tablet' | 'mobile' | string;

export interface ViewportProfile {
  name: ViewportName;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  userAgent?: string;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type VisualObservationType =
  | 'HORIZONTAL_OVERFLOW'
  | 'VERTICAL_OVERFLOW'
  | 'CONTENT_CLIPPED'
  | 'ELEMENT_OUT_OF_VIEW'
  | 'ELEMENT_OVERLAP'
  | 'TEXT_OVERFLOW'
  | 'RESPONSIVE_INTERACTION_FAILURE'
  | 'RESPONSIVE_NAVIGATION_FAILURE'
  | 'LAYOUT_SHIFT'
  | 'VISUAL_REGRESSION'
  | 'BASELINE_MISSING';

export type VisualSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface VisualObservation {
  id: string;
  type: VisualObservationType;
  pageUrl: string;
  viewport: ViewportProfile;
  severity: VisualSeverity;
  title: string;
  description: string;
  selector?: string;
  secondarySelector?: string;
  boundingBox?: BoundingBox;
  secondaryBoundingBox?: BoundingBox;
  overlapArea?: number;
  overflowAmount?: number;
  shiftAmount?: number;
  comparisonRatio?: number;
  reproductionSteps?: Array<{
    stepNumber: number;
    action: string;
    target: string;
    expected: string;
  }>;
  screenshot?: CapturedScreenshot;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface VisualSnapshot {
  id: string;
  testRunId: string;
  projectId: string;
  pageUrl: string;
  viewport: ViewportProfile;
  width: number;
  height: number;
  screenshotPath?: string;
  storageUrl?: string;
  buffer?: Buffer;
  capturedAt: string;
  metadata?: Record<string, any>;
}

export type VisualComparisonStatus =
  | 'PASS'
  | 'INFO'
  | 'MEDIUM'
  | 'HIGH'
  | 'BASELINE_MISSING'
  | 'DIMENSION_MISMATCH';

export interface VisualComparison {
  id: string;
  baselineId?: string;
  currentId: string;
  pageUrl: string;
  viewport: ViewportProfile;
  pixelDifferenceRatio: number;
  changedPixelCount: number;
  totalPixelCount: number;
  boundingRegion?: BoundingBox;
  status: VisualComparisonStatus;
  threshold: number;
  diffBuffer?: Buffer;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ResponsiveExecutionResult {
  viewports: ViewportProfile[];
  snapshots: VisualSnapshot[];
  comparisons: VisualComparison[];
  observations: VisualObservation[];
  durationMs: number;
}

export interface VisualEngineOptions {
  viewports?: ViewportProfile[];
  maxPages?: number;
  maxExecutionTimeMs?: number;
  thresholds?: {
    pass: number;
    info: number;
    medium: number;
    high: number;
  };
  allowLocalhost?: boolean;
}
