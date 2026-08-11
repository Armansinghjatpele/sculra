// ==============================================================================
// Sculra Analytics Abstraction Layer (frontend/lib/analytics.ts)
// ==============================================================================
// Provides a clean abstraction interface for tracking analytics events.
// Prevents scattering direct PostHog references throughout UI layouts.
// Handles safe fallback mock tracking when keys are missing.

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
}

class AnalyticsManager {
  private isInitialized = false;
  private posthogInstance: any = null;

  /**
   * Initializes the PostHog analytics tracking service.
   * Gracefully falls back to console logger in development if keys are missing.
   */
  public async initAnalytics() {
    if (this.isInitialized) return;

    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!posthogKey) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics]: PostHog keys are missing. Analytics is in dev-mock mode.');
      }
      this.isInitialized = true;
      return;
    }

    try {
      // Dynamic import to support SSR environments and lazy loading optimization
      const posthogModule = await import('posthog-js');
      this.posthogInstance = posthogModule.default;
      
      this.posthogInstance.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: false, // Pageviews handled explicitly by Router hook
        persistence: 'localStorage',
        autocapture: false, // Restrict autocapture for strict user-action control
      });
      
      this.isInitialized = true;
    } catch (error) {
      console.error('[Analytics]: Failed to load posthog-js SDK', error);
    }
  }

  /**
   * Captures a custom tracking event.
   */
  public trackEvent(name: string, properties?: Record<string, any>) {
    if (!this.isInitialized) {
      this.initAnalytics().then(() => this.trackEvent(name, properties));
      return;
    }

    if (this.posthogInstance) {
      this.posthogInstance.capture(name, properties);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics Dev Log]: Event captured -> Name: "${name}"`, properties);
    }
  }

  /**
   * Identifies an authenticated user session.
   */
  public identifyUser(userId: string, userProperties?: Record<string, any>) {
    if (!this.isInitialized) return;

    if (this.posthogInstance) {
      this.posthogInstance.identify(userId, userProperties);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics Dev Log]: User Identified -> ID: ${userId}`, userProperties);
    }
  }

  /**
   * Resets active analytics session (on user logout).
   */
  public resetAnalytics() {
    if (!this.isInitialized) return;

    if (this.posthogInstance) {
      this.posthogInstance.reset();
    } else if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics Dev Log]: Tracking Session Reset.');
    }
  }
}

// Export a singleton instance of the manager
export const analytics = new AnalyticsManager();
export default analytics;
