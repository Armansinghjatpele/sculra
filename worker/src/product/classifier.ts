// ==============================================================================
// Sculra Semantic Page Classifier (worker/src/product/classifier.ts)
// ==============================================================================

import { DiscoveredPage } from '../types';
import { SemanticPageCategory, SemanticPageClassification } from './types';

export class SemanticPageClassifier {
  /**
   * Deterministically classifies a discovered page into a semantic product category.
   */
  public static classifyPage(page: DiscoveredPage, rootUrl: string): SemanticPageClassification {
    const urlStr = page.url || '';
    let pathname = '';
    try {
      pathname = new URL(urlStr).pathname.toLowerCase();
    } catch {
      pathname = urlStr.toLowerCase();
    }

    const titleLower = (page.title || '').toLowerCase();
    const headingsText = (page.elements || [])
      .filter((e) => e.tagName && /^h[1-6]$/i.test(e.tagName))
      .map((e) => (e.text || e.accessibleName || '').toLowerCase())
      .join(' ');
    const buttonsText = (page.elements || [])
      .filter((e) => e.type === 'button' || e.role === 'button')
      .map((e) => (e.text || e.accessibleName || '').toLowerCase())
      .join(' ');
    const formsFieldNames = (page.forms || [])
      .flatMap((f) => (f.fields || []).map((field) => (field.name || field.label || '').toLowerCase()))
      .join(' ');

    const allText = `${pathname} ${titleLower} ${headingsText} ${buttonsText} ${formsFieldNames}`;
    const evidence: string[] = [];

    // 1. Root / Landing Page Check
    const isRoot = pathname === '/' || pathname === '' || page.url.replace(/\/$/, '') === rootUrl.replace(/\/$/, '');
    if (isRoot && page.depth === 0) {
      if (allText.includes('dashboard') || allText.includes('overview') || allText.includes('metrics')) {
        evidence.push('Root route contains dashboard overview terminology.');
        return { pageUrl: page.url, category: 'DASHBOARD', confidence: 0.85, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
      }
      evidence.push('Entry root URL of application with depth 0.');
      return { pageUrl: page.url, category: 'LANDING', confidence: 0.95, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // 2. Authentication & Sign-in / Sign-up
    if (/sign[-_]?up|register|join|create[-_]?account/i.test(pathname) || /sign[-_]?up|create your account|register/i.test(titleLower + headingsText)) {
      evidence.push(`Registration tokens found in route (${pathname}) or headings.`);
      return { pageUrl: page.url, category: 'SIGN_UP', confidence: 0.95, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if (/sign[-_]?in|login|log[-_]?in|auth/i.test(pathname) || /sign in|log in|welcome back/i.test(titleLower + headingsText)) {
      evidence.push(`Authentication / Login keywords present in route or headings.`);
      return { pageUrl: page.url, category: 'LOGIN', confidence: 0.95, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // 3. Admin & Organization Management
    if (/admin|manage[-_]?users|permissions|roles/i.test(pathname) || /admin console|administration|user management/i.test(titleLower + headingsText)) {
      evidence.push(`Administrative access keywords found in route (${pathname}) and content.`);
      return { pageUrl: page.url, category: 'ADMIN', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // 4. Settings & Profile
    if (/settings|preferences|account[-_]?settings|config/i.test(pathname) || /settings|preferences|account configuration/i.test(titleLower)) {
      evidence.push(`Configuration and preferences keywords in route (${pathname}).`);
      return { pageUrl: page.url, category: 'SETTINGS', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if (/profile|user[-_]?profile|my[-_]?account|user-settings/i.test(pathname) || /user profile|my profile/i.test(titleLower)) {
      evidence.push(`User identity and profile keywords in route (${pathname}).`);
      return { pageUrl: page.url, category: 'PROFILE', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // 5. Checkout, Billing, Payment & Cart
    if (/checkout|payment|pay|billing|subscribe|subscription/i.test(pathname) || /checkout|payment details|billing|credit card/i.test(allText)) {
      if (/checkout/i.test(pathname) || /checkout/i.test(titleLower)) {
        evidence.push(`E-commerce or SaaS checkout flow markers on route ${pathname}.`);
        return { pageUrl: page.url, category: 'CHECKOUT', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
      }
      evidence.push(`Payment processing or subscription billing terminology detected.`);
      return { pageUrl: page.url, category: 'PAYMENT', confidence: 0.88, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if (/cart|basket|bag/i.test(pathname) || /shopping cart|your basket/i.test(titleLower + headingsText)) {
      evidence.push(`Shopping cart indicators found on route ${pathname}.`);
      return { pageUrl: page.url, category: 'CART', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // 6. Analytics, Metrics & Reports
    if (/analytics|insights|metrics|telemetry/i.test(pathname) || /analytics dashboard|usage metrics/i.test(titleLower + headingsText)) {
      evidence.push(`Analytics and metrics telemetry keywords found.`);
      return { pageUrl: page.url, category: 'ANALYTICS', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if (/reports|report|summary|export/i.test(pathname) || /generated reports|audit report/i.test(titleLower + headingsText)) {
      evidence.push(`Reporting and export terminology detected.`);
      return { pageUrl: page.url, category: 'REPORT', confidence: 0.88, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // 7. Dashboard Overview
    if (/dashboard|home|overview|workspace|console/i.test(pathname) || /dashboard|workspace overview|control panel/i.test(titleLower)) {
      evidence.push(`Workspace dashboard overview keywords on route ${pathname}.`);
      return { pageUrl: page.url, category: 'DASHBOARD', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // 8. CRUD Operations: Create / Edit / Detail / List
    if (/new|create|add[-_]?|compose/i.test(pathname) || /create new|add new|new project|create item/i.test(titleLower + headingsText + buttonsText)) {
      evidence.push(`Resource creation markers (new/create) on route ${pathname}.`);
      return { pageUrl: page.url, category: 'CREATE', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if (/edit|modify|update/i.test(pathname) || /edit item|update project|save changes/i.test(titleLower + headingsText + buttonsText)) {
      evidence.push(`Resource modification / edit markers on route ${pathname}.`);
      return { pageUrl: page.url, category: 'EDIT', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // Check for ID-based detail routes (e.g. /projects/123, /items/item-abc)
    const isDetailRoute = /\/(?:[a-z0-9_-]+)\/(?:[a-z0-9_-]{6,}|\d+|[0-9a-f-]{36})$/i.test(pathname);
    if (isDetailRoute) {
      evidence.push(`Specific resource identifier in route path (${pathname}).`);
      return { pageUrl: page.url, category: 'DETAIL', confidence: 0.85, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if (/search|find|query/i.test(pathname) || /search results|query/i.test(titleLower)) {
      evidence.push(`Search query keywords detected.`);
      return { pageUrl: page.url, category: 'SEARCH', confidence: 0.88, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if (/help|support|docs|faq|documentation/i.test(pathname) || /help center|documentation|knowledge base/i.test(titleLower)) {
      evidence.push(`Support, documentation, or FAQ content route.`);
      return { pageUrl: page.url, category: 'HELP', confidence: 0.9, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    // Fallback based on elements
    if ((page.forms || []).length > 0 && ((page.forms[0].fields || []).length >= 2)) {
      evidence.push('Contains interactive form with multiple fields.');
      return { pageUrl: page.url, category: 'CREATE', confidence: 0.65, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    if ((page.links || []).length > 5) {
      evidence.push('Contains structured list of outbound navigation links.');
      return { pageUrl: page.url, category: 'LIST', confidence: 0.65, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
    }

    evidence.push('General content page without specialized control signatures.');
    return { pageUrl: page.url, category: 'CONTENT', confidence: 0.6, evidence, source: 'DETERMINISTIC', title: page.title, depth: page.depth };
  }

  /**
   * Classifies all discovered pages in an ApplicationMap.
   */
  public static classifyAllPages(pages: DiscoveredPage[], rootUrl: string): SemanticPageClassification[] {
    return pages.map((page) => this.classifyPage(page, rootUrl));
  }
}
