// ==============================================================================
// Sculra Accessibility & Inclusive UX Domain Models (worker/src/accessibility/types.ts)
// ==============================================================================

import { BugObservation } from '../issues/types';
import { ViewportConfig } from '../types';

export type AccessibilityFindingType =
  | 'MISSING_ACCESSIBLE_NAME'
  | 'EMPTY_BUTTON_NAME'
  | 'EMPTY_LINK_NAME'
  | 'INPUT_MISSING_LABEL'
  | 'LABEL_NOT_ASSOCIATED'
  | 'INVALID_FORM_LABEL'
  | 'INVALID_ARIA_USAGE'
  | 'ARIA_ATTRIBUTE_INVALID'
  | 'ARIA_ROLE_INVALID'
  | 'ARIA_HIDDEN_FOCUSABLE'
  | 'HEADING_HIERARCHY_ERROR'
  | 'MISSING_MAIN_LANDMARK'
  | 'DUPLICATE_MAIN_LANDMARK'
  | 'LANDMARK_STRUCTURE_ERROR'
  | 'DIALOG_ACCESSIBILITY_ERROR'
  | 'DIALOG_MISSING_NAME'
  | 'DIALOG_FOCUS_ERROR'
  | 'FOCUS_NOT_VISIBLE'
  | 'FOCUS_ORDER_ERROR'
  | 'KEYBOARD_INACCESSIBLE'
  | 'KEYBOARD_TRAP'
  | 'SKIP_NAVIGATION_FAILURE'
  | 'TAB_ORDER_ERROR'
  | 'IMAGE_MISSING_ALT'
  | 'IMAGE_INVALID_ALT'
  | 'FORM_ERROR_NOT_ACCESSIBLE'
  | 'ERROR_MESSAGE_NOT_ASSOCIATED'
  | 'REQUIRED_FIELD_NOT_EXPOSED'
  | 'STATUS_MESSAGE_NOT_ACCESSIBLE'
  | 'CONTRAST_FAILURE'
  | 'TEXT_SCALING_FAILURE'
  | 'CONTENT_CLIPPED_ON_TEXT_SCALE'
  | 'REDUCED_MOTION_FAILURE'
  | 'TOUCH_TARGET_TOO_SMALL'
  | 'DISABLED_STATE_INACCESSIBLE'
  | 'LOADING_STATE_INACCESSIBLE'
  | 'HIDDEN_CONTENT_FOCUSABLE'
  | 'CONTENT_NOT_REACHABLE_BY_KEYBOARD'
  | 'ACCESSIBILITY_REGRESSION'
  | 'ACCESSIBILITY_CHECK_INCONCLUSIVE'
  | 'ACCESSIBILITY_CONFIGURATION_ERROR';

export type WcagPrinciple = 'Perceivable' | 'Operable' | 'Understandable' | 'Robust';

export type WcagLevel = 'A' | 'AA' | 'AAA';

export type AccessibilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AccessibilityConfidence = 'high' | 'medium' | 'low';

export type AccessibilityTargetType =
  | 'PAGE'
  | 'BUTTON'
  | 'LINK'
  | 'FORM'
  | 'INPUT'
  | 'DIALOG'
  | 'HEADING'
  | 'LANDMARK'
  | 'IMAGE'
  | 'KEYBOARD_FLOW'
  | 'CONTRAST'
  | 'TOUCH_TARGET'
  | 'RESPONSIVE_VIEW';

export interface AccessibilityTarget {
  id: string;
  targetType: AccessibilityTargetType;
  pageUrl: string;
  selector?: string;
  role?: string;
  priority: number;
  reason: string;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  authRole?: string;
  viewport?: ViewportConfig;
}

export interface AccessibilityFinding {
  id: string;
  type: AccessibilityFindingType;
  title: string;
  wcagReference: string;
  wcagCriterion?: string;
  wcagLevel?: WcagLevel;
  wcagPrinciple?: string;
  criterion?: string;
  principle: WcagPrinciple;
  severity: AccessibilitySeverity;
  confidence: AccessibilityConfidence;
  description: string;
  deterministicReason: string;
  remediationRecommendation: string;
  targetUrl: string;
  selector?: string;
  role?: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  evidence: Record<string, any>;
  fingerprint: string;
  screenshotPath?: string;
  timestamp: string;
}

export interface FocusedElementTrace {
  order: number;
  selector: string;
  tagName: string;
  role?: string;
  accessibleName?: string;
  tabIndex?: number;
  hasVisibleFocus?: boolean;
  computedOutline?: string;
  computedBoxShadow?: string;
  isVisible: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface KeyboardNavigationResult {
  pageUrl: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  totalSteps: number;
  focusedSequence: FocusedElementTrace[];
  unreachableElementsCount: number;
  unreachableSelectors: string[];
  trapsDetected: boolean;
  trapDetails?: { selector: string; cyclicStepCount: number };
  durationMs: number;
}

export interface FocusVisibilityResult {
  pageUrl: string;
  selector: string;
  role?: string;
  accessibleName?: string;
  outlineWidth: number;
  outlineStyle: string;
  outlineColor: string;
  boxShadow: string;
  hasDistinctBorderOrBackground: boolean;
  isVisible: boolean;
  isConclusive: boolean;
  inconclusiveReason?: string;
}

export interface FormInputAccessibility {
  selector: string;
  name?: string;
  type: string;
  accessibleName?: string;
  hasAssociatedLabel: boolean;
  labelSource?: 'for_id' | 'enclosing_label' | 'aria_labelledby' | 'aria_label' | 'title' | 'placeholder';
  isRequired: boolean;
  hasAriaRequired: boolean;
  hasAutocomplete: boolean;
  autocompleteValue?: string;
  isInvalid: boolean;
  hasAssociatedError: boolean;
  errorAssociationSource?: 'aria_describedby' | 'aria_errormessage';
  errorMessageText?: string;
}

export interface FormAccessibilityResult {
  pageUrl: string;
  formSelector: string;
  inputsCount: number;
  inputs: FormInputAccessibility[];
  isAccessible: boolean;
  defects: string[];
}

export interface HeadingItem {
  level: number;
  text: string;
  selector: string;
  isSkipped: boolean;
  isEmpty: boolean;
}

export interface LandmarkItem {
  role: string;
  tagName: string;
  name?: string;
  selector: string;
}

export interface ImageAccessibilityItem {
  selector: string;
  src: string;
  alt: string | null;
  isMissingAlt: boolean;
  isInvalidAlt: boolean;
  isDecorative: boolean;
  role?: string;
}

export interface AriaValidationItem {
  selector: string;
  invalidRoles: string[];
  invalidAttributes: string[];
  hiddenFocusable: boolean;
  brokenReferences: string[];
}

export interface SemanticAnalysisResult {
  pageUrl: string;
  headings: HeadingItem[];
  hasSkippedHeadings: boolean;
  hasMainLandmark: boolean;
  duplicateMainLandmarksCount: number;
  landmarks: LandmarkItem[];
  images: ImageAccessibilityItem[];
  ariaChecks: AriaValidationItem[];
}

export interface ContrastCheckResult {
  pageUrl: string;
  selector: string;
  textSnippet: string;
  fontSizePx: number;
  fontWeight: string;
  isLargeText: boolean;
  computedColor: string;
  computedBgColor: string;
  contrastRatio: number;
  requiredRatio: number;
  isConclusive: boolean;
  inconclusiveReason?: string;
  status: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
}

export interface TextScalingResult {
  pageUrl: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  zoomScale: number; // e.g. 2.0 (200%)
  clippedElements: Array<{ selector: string; text: string; clientWidth: number; scrollWidth: number }>;
  overlappingElementsCount: number;
  hasHorizontalOverflow: boolean;
  scrollWidth: number;
  innerWidth: number;
  status: 'PASS' | 'FAIL';
}

export interface ReducedMotionResult {
  pageUrl: string;
  animatingElements: Array<{
    selector: string;
    animationName?: string;
    animationDuration?: string;
    transitionDuration?: string;
    respectsReducedMotion: boolean;
  }>;
  status: 'PASS' | 'FAIL';
}

export interface TouchTargetResult {
  pageUrl: string;
  selector: string;
  role?: string;
  accessibleName?: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isCompliant: boolean;
  minimumRequired: number; // 24 or 44
}

export interface DialogAccessibilityResult {
  pageUrl: string;
  selector: string;
  accessibleName?: string;
  hasAccessibleName: boolean;
  focusTrapped: boolean;
  closesOnEscape: boolean;
  hasAccessibleCloseButton: boolean;
}

export interface AccessibilityCoverageSummary {
  targetsDiscovered: number;
  targetsTested: number;
  pagesTested: number;
  totalChecks: number;
  keyboardChecks: number;
  focusChecks: number;
  formChecks: number;
  contrastChecks: number;
  touchTargetChecks: number;
  semanticChecks: number;
  responsiveChecks: number;
  findingsCount: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  inconclusiveCount: number;
  accessibilityScore?: number; // 0 - 100, undefined if unmeasured
  durationMs: number;
  keyboardNavigationSteps?: number;
  keyboardTrapsCount?: number;
  contrastChecksCount?: number;
  touchTargetsChecked?: number;
  formControlsChecked?: number;
  headingsChecked?: number;
  landmarksChecked?: number;
  viewportsTested?: string[];
}

export type { AccessibilityPolicyConfig } from './policy';

export interface AccessibilityScanResult {
  testRunId: string;
  projectId: string;
  targetUrl: string;
  coverage: AccessibilityCoverageSummary;
  findings: AccessibilityFinding[];
  bugObservations: BugObservation[];
  keyboardResults: KeyboardNavigationResult[];
  contrastResults: ContrastCheckResult[];
  touchTargetResults: TouchTargetResult[];
  formResults: FormAccessibilityResult[];
  semanticResults: SemanticAnalysisResult[];
  textScalingResults: TextScalingResult[];
  reducedMotionResults: ReducedMotionResult[];
  dialogResults: DialogAccessibilityResult[];
  baselines?: any[];
}

