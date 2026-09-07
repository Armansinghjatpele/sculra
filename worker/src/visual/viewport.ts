// ==============================================================================
// Sculra Viewport Profile Matrix & Configuration (worker/src/visual/viewport.ts)
// ==============================================================================

import { ViewportProfile } from './types';

export const STANDARD_VIEWPORTS: Record<'DESKTOP' | 'TABLET' | 'MOBILE', ViewportProfile> = {
  DESKTOP: {
    name: 'desktop',
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  TABLET: {
    name: 'tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  MOBILE: {
    name: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 SculraQA/1.0',
  },
};

export const DEFAULT_VIEWPORT_PROFILES: ViewportProfile[] = [
  STANDARD_VIEWPORTS.DESKTOP,
  STANDARD_VIEWPORTS.TABLET,
  STANDARD_VIEWPORTS.MOBILE,
];

export const VISUAL_LIMITS = {
  MAX_RESPONSIVE_PAGES: 10,
  MAX_VIEWPORTS: 5,
  MAX_SCREENSHOTS_PER_PAGE_PER_VIEWPORT: 2,
  MAX_RESPONSIVE_EXECUTION_TIME_MS: 120000, // 120 seconds
};

export function getViewportProfile(nameOrWidth: string | number): ViewportProfile {
  if (typeof nameOrWidth === 'number') {
    if (nameOrWidth >= 1200) return STANDARD_VIEWPORTS.DESKTOP;
    if (nameOrWidth >= 600) return STANDARD_VIEWPORTS.TABLET;
    return STANDARD_VIEWPORTS.MOBILE;
  }

  const normalized = nameOrWidth.toLowerCase();
  if (normalized === 'desktop' || normalized === '1440x900' || normalized === '1440') {
    return STANDARD_VIEWPORTS.DESKTOP;
  }
  if (normalized === 'tablet' || normalized === '768x1024' || normalized === '768') {
    return STANDARD_VIEWPORTS.TABLET;
  }
  if (normalized === 'mobile' || normalized === '390x844' || normalized === '390') {
    return STANDARD_VIEWPORTS.MOBILE;
  }

  // Fallback / custom profile
  return {
    name: normalized,
    width: 1280,
    height: 720,
    isMobile: false,
    hasTouch: false,
  };
}
