// ==============================================================================
// Sculra Product Evidence Extraction Layer (worker/src/product/evidence.ts)
// ==============================================================================

import { ApplicationMap, DiscoveredPage } from '../types';
import { JourneyResult } from '../journeys/types';
import { BugObservation } from '../issues/types';
import { ProductEvidence, ProductEvidenceSourceType } from './types';

export class ProductEvidenceExtractor {
  // Sensitive patterns that must ALWAYS be redacted from evidence content
  private static readonly REDACTION_PATTERNS = [
    /Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi,
    /(?:api[_-]?key|secret|token|password|passwd|auth[_-]?token)\s*[:=]\s*['"]?([A-Za-z0-9\-\._~]{8,})['"]?/gi,
    /\b(?:\d[ -]*?){13,16}\b/g, // Credit card numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails (partially masked)
  ];

  /**
   * Sanitizes text by stripping or redacting sensitive patterns.
   */
  public static sanitizeEvidenceText(text: string): string {
    if (!text) return '';
    let sanitized = text;
    for (const pattern of this.REDACTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    }
    return sanitized.trim();
  }

  /**
   * Extracts grounded product evidence from discovery and execution traces.
   */
  public static extractEvidence(options: {
    targetUrl: string;
    applicationMap?: ApplicationMap;
    journeyResults?: JourneyResult[];
    bugObservations?: BugObservation[];
  }): ProductEvidence[] {
    const evidenceList: ProductEvidence[] = [];
    const seenEvidenceHashes = new Set<string>();

    const addEvidence = (
      sourceType: ProductEvidenceSourceType,
      pageUrl: string,
      content: string,
      confidence: number,
      metadata?: Record<string, any>
    ) => {
      const sanitized = this.sanitizeEvidenceText(content);
      if (!sanitized || sanitized.length < 2) return;

      const hash = `${sourceType}:${pageUrl}:${sanitized.toLowerCase()}`;
      if (seenEvidenceHashes.has(hash)) return;
      seenEvidenceHashes.add(hash);

      evidenceList.push({
        id: `ev-${sourceType.toLowerCase()}-${evidenceList.length + 1}`,
        sourceType,
        pageUrl,
        content: sanitized,
        confidence: Math.max(0.1, Math.min(1.0, confidence)),
        metadata,
      });
    };

    const { targetUrl, applicationMap, journeyResults, bugObservations } = options;

    // 1. Root & Discovery Map Evidence
    if (targetUrl) {
      addEvidence('URL', targetUrl, `Root target URL: ${targetUrl}`, 1.0);
    }

    if (applicationMap?.pages) {
      for (const page of applicationMap.pages) {
        // Page URL & Title Evidence
        if (page.url) {
          addEvidence('URL', page.url, `Discovered route: ${page.url}`, 1.0, { depth: page.depth });
        }
        if (page.title) {
          addEvidence('METADATA', page.url, `Page title: "${page.title}"`, 0.95);
        }

        // Headings & Accessible Elements Evidence
        if (page.elements) {
          for (const el of page.elements) {
            const tagName = el.tagName?.toLowerCase();
            const text = el.text || el.accessibleName;

            if (tagName && /^h[1-6]$/.test(tagName) && text) {
              addEvidence('HEADING', page.url, `${tagName.toUpperCase()}: "${text}"`, 0.9, { selector: el.selector });
            } else if (el.type === 'button' || el.role === 'button') {
              if (text) {
                addEvidence('BUTTON', page.url, `Interactive button: "${text}"`, 0.85, {
                  selector: el.selector,
                  isPrimary: (el as any).isPrimaryCta || false,
                });
              }
            }
          }
        }

        // Form & Input Field Evidence
        if (page.forms) {
          for (const form of page.forms) {
            const fieldNames = (form.fields || []).map((f) => f.name || f.label || f.type).filter(Boolean);
            const formDesc = `Form (method: ${form.method || 'POST'}, action: ${form.action || 'self'}) with fields: [${fieldNames.join(', ')}]`;
            addEvidence('FORM', page.url, formDesc, 0.9, {
              fieldsCount: (form.fields || []).length,
              fields: fieldNames,
            });
          }
        }

        // Internal Navigation Links Evidence
        if (page.links) {
          for (const link of page.links) {
            if (link.href && link.isInternal) {
              addEvidence('NAV', page.url, `Navigation link: "${link.text || link.href}" -> ${link.href}`, 0.8, {
                href: link.href,
              });
            }
          }
        }

        // Console & Network Error Evidence
        if (page.consoleErrors) {
          for (const cErr of page.consoleErrors) {
            addEvidence('ERROR', page.url, `Console error on ${page.url}: ${cErr.message}`, 0.95);
          }
        }
      }
    }

    // 2. Journey Execution Evidence
    if (journeyResults) {
      for (const journey of journeyResults) {
        const pathDesc = (journey.pagesVisited || []).join(' -> ');
        addEvidence(
          'JOURNEY',
          journey.pagesVisited?.[0] || targetUrl,
          `User journey "${journey.name}" (${journey.category}) executed: ${pathDesc} (Status: ${journey.status})`,
          0.9,
          {
            journeyId: journey.journeyId,
            status: journey.status,
            actionsPassed: journey.actionsPassed,
          }
        );
      }
    }

    // 3. Bug Observation Evidence
    if (bugObservations) {
      for (const bug of bugObservations) {
        addEvidence(
          'OBSERVATION',
          bug.url || targetUrl,
          `Bug Observation [${bug.severity.toUpperCase()}]: ${bug.title} (${bug.type})`,
          0.9,
          {
            type: bug.type,
            severity: bug.severity,
          }
        );
      }
    }

    return evidenceList;
  }
}
