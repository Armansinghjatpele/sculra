// ==============================================================================
// Sculra Accessibility & Inclusive UX Execution Policy (worker/src/accessibility/policy.ts)
// ==============================================================================

import { ViewportConfig } from '../types';

export interface AccessibilityPolicyConfig {
  maxTargets: number;
  maxPages: number;
  maxInteractiveElementsPerPage: number;
  maxKeyboardSteps: number;
  maxFocusableElements: number;
  maxKeyboardTrapSteps: number;
  maxDialogChecks: number;
  maxFormChecks: number;
  maxContrastChecks: number;
  maxTouchTargetChecks: number;
  maxViewports: number;
  maxExecutionTimeMs: number;
  timeoutMs: number;
  viewports: ViewportConfig[];
  contrastNormalThreshold: number;
  contrastLargeThreshold: number;
  touchTargetMinDimension: number; // 24px (WCAG 2.2 AA) or 44px (WCAG 2.1 AAA)
  enableKeyboardTesting: boolean;
  enableFocusVisibility: boolean;
  enableFormTesting: boolean;
  enableSemanticValidation: boolean;
  enableAriaValidation: boolean;
  enableContrastAnalysis: boolean;
  enableTextScaling: boolean;
  enableReducedMotion: boolean;
  enableTouchTargetAnalysis: boolean;
  enableDialogTesting: boolean;
  enableResponsiveTesting: boolean;
}

export const DEFAULT_ACCESSIBILITY_POLICY: AccessibilityPolicyConfig = {
  maxTargets: 50,
  maxPages: 15,
  maxInteractiveElementsPerPage: 200,
  maxKeyboardSteps: 150,
  maxFocusableElements: 200,
  maxKeyboardTrapSteps: 20,
  maxDialogChecks: 20,
  maxFormChecks: 50,
  maxContrastChecks: 100,
  maxTouchTargetChecks: 150,
  maxViewports: 3,
  maxExecutionTimeMs: 120000,
  timeoutMs: 15000,
  viewports: [
    { width: 1440, height: 900, name: 'desktop' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 390, height: 844, name: 'mobile' },
  ],
  contrastNormalThreshold: 4.5,
  contrastLargeThreshold: 3.0,
  touchTargetMinDimension: 24,
  enableKeyboardTesting: true,
  enableFocusVisibility: true,
  enableFormTesting: true,
  enableSemanticValidation: true,
  enableAriaValidation: true,
  enableContrastAnalysis: true,
  enableTextScaling: true,
  enableReducedMotion: true,
  enableTouchTargetAnalysis: true,
  enableDialogTesting: true,
  enableResponsiveTesting: true,
};

