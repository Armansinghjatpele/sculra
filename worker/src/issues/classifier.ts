// ==============================================================================
// Sculra Deterministic Issue Classifier (worker/src/issues/classifier.ts)
// ==============================================================================

import {
  BugObservation,
  BugType,
  StructuredReproductionStep,
} from './types';
import { JourneyResult, JourneyStepExecution } from '../journeys/types';
import { CapturedConsoleError, CapturedNetworkError, CapturedScreenshot } from '../types';
import { computeBugFingerprint } from './fingerprint';
import { calculateBugSeverity, isPrimaryCTA } from './severity';
import { isCriticalNetworkFailure, sanitizeUrl } from './network';
import { classifyConsoleError } from './console';

export interface ClassifierInput {
  testRunId: string;
  projectId: string;
  organizationId?: string;
  targetUrl: string;
  journeyResults?: JourneyResult[];
  consoleErrors?: CapturedConsoleError[];
  networkErrors?: CapturedNetworkError[];
  screenshots?: CapturedScreenshot[];
}

export class DeterministicIssueClassifier {
  classify(input: ClassifierInput): BugObservation[] {
    const bugs: BugObservation[] = [];
    const seenFingerprints = new Set<string>();

    const addBugIfUnique = (bug: BugObservation) => {
      if (!seenFingerprints.has(bug.fingerprint)) {
        seenFingerprints.add(bug.fingerprint);
        bugs.push(bug);
      }
    };

    // ============================================================================
    // 1. Process User Journey Results & Step Executions
    // ============================================================================
    if (input.journeyResults) {
      for (const journey of input.journeyResults) {
        const priorSteps: JourneyStepExecution[] = [];

        for (const step of journey.steps) {
          priorSteps.push(step);

          // Handle step failure
          if (step.status === 'FAILED') {
            const bugType: BugType =
              step.action === 'NAVIGATE'
                ? 'NAVIGATION_FAILURE'
                : step.action === 'CLICK'
                ? 'BROKEN_CONTROL'
                : 'UNKNOWN_FUNCTIONAL_FAILURE';

            const severity = calculateBugSeverity({
              bugType,
              url: step.beforeUrl || input.targetUrl,
              targetDescription: step.targetDescription,
              selector: step.selector,
            });

            const reproductionSteps = this.buildReproductionSteps(priorSteps, step.error || 'Step failed unexpectedly');

            const fingerprint = computeBugFingerprint({
              projectId: input.projectId,
              url: step.beforeUrl || input.targetUrl,
              bugType,
              selector: step.selector,
              action: step.action,
              errorSignature: step.error,
            });

            addBugIfUnique({
              id: `bug-${fingerprint.substring(0, 12)}`,
              testRunId: input.testRunId,
              journeyId: journey.journeyId,
              stepId: step.stepId,
              projectId: input.projectId,
              organizationId: input.organizationId,
              type: bugType,
              severity,
              confidence: 'high',
              status: 'open',
              title: `${bugType === 'BROKEN_CONTROL' ? 'Broken control' : 'Action failure'}: ${step.targetDescription}`,
              summary: step.error || `Action "${step.action}" on "${step.targetDescription}" failed during execution.`,
              description: `During journey "${journey.name}", step "${step.action}" failed on element "${step.targetDescription}". Error details: ${step.error || 'None'}.`,
              url: sanitizeUrl(step.beforeUrl || input.targetUrl),
              finalUrl: sanitizeUrl(step.afterUrl || step.beforeUrl),
              action: step.action,
              selector: step.selector,
              errorSignature: step.error,
              reproductionSteps,
              fingerprint,
              timestamp: step.finishedAt || new Date().toISOString(),
              metadata: {
                journeyName: journey.name,
                category: journey.category,
                viewport: journey.viewport,
              },
            });
          }

          // Handle observations inside step
          for (const obs of step.observations) {
            // A. No-Op Button Click
            if (obs.type === 'CLICK_NO_OP') {
              const isCTA = isPrimaryCTA(step.targetDescription, step.selector);
              const severity = isCTA ? 'high' : 'medium';
              const reproductionSteps = this.buildReproductionSteps(
                priorSteps,
                'Clicked control but observed zero state or DOM mutations'
              );

              const fingerprint = computeBugFingerprint({
                projectId: input.projectId,
                url: obs.pageUrl,
                bugType: 'BROKEN_CONTROL',
                selector: obs.selector || step.selector,
                action: 'CLICK',
                errorSignature: 'click_no_op',
              });

              addBugIfUnique({
                id: `bug-${fingerprint.substring(0, 12)}`,
                testRunId: input.testRunId,
                journeyId: journey.journeyId,
                stepId: step.stepId,
                projectId: input.projectId,
                organizationId: input.organizationId,
                type: 'BROKEN_CONTROL',
                severity,
                confidence: 'high',
                status: 'open',
                title: `Broken control: ${step.targetDescription}`,
                summary: `Element "${step.targetDescription}" clicked successfully but triggered zero state or DOM mutations.`,
                description: `Interactive control "${step.targetDescription}" (${obs.selector || step.selector}) did not trigger any DOM update, navigation, dialog, or active state change upon click.`,
                url: sanitizeUrl(obs.pageUrl),
                action: 'CLICK',
                selector: obs.selector || step.selector,
                errorSignature: 'click_no_op',
                reproductionSteps,
                fingerprint,
                timestamp: obs.timestamp,
                metadata: {
                  journeyName: journey.name,
                  viewport: journey.viewport,
                },
              });
            }

            // B. Element Not Interactable
            if (obs.type === 'ELEMENT_NOT_INTERACTABLE') {
              const reproductionSteps = this.buildReproductionSteps(priorSteps, obs.message);
              const fingerprint = computeBugFingerprint({
                projectId: input.projectId,
                url: obs.pageUrl,
                bugType: 'ELEMENT_NOT_INTERACTABLE',
                selector: obs.selector || step.selector,
                action: step.action,
                errorSignature: obs.message,
              });

              addBugIfUnique({
                id: `bug-${fingerprint.substring(0, 12)}`,
                testRunId: input.testRunId,
                journeyId: journey.journeyId,
                stepId: step.stepId,
                projectId: input.projectId,
                organizationId: input.organizationId,
                type: 'ELEMENT_NOT_INTERACTABLE',
                severity: 'medium',
                confidence: 'high',
                status: 'open',
                title: `Element not interactable: ${step.targetDescription}`,
                summary: obs.message,
                description: `Unable to interact with "${step.targetDescription}" (${obs.selector || step.selector}) on ${obs.pageUrl}.`,
                url: sanitizeUrl(obs.pageUrl),
                action: step.action,
                selector: obs.selector || step.selector,
                errorSignature: obs.message,
                reproductionSteps,
                fingerprint,
                timestamp: obs.timestamp,
                metadata: {
                  journeyName: journey.name,
                },
              });
            }

            // C. Navigation failure inside observation
            if (obs.type === 'NAVIGATION_FAILURE') {
              const reproductionSteps = this.buildReproductionSteps(priorSteps, obs.message);
              const fingerprint = computeBugFingerprint({
                projectId: input.projectId,
                url: obs.pageUrl,
                bugType: 'NAVIGATION_FAILURE',
                action: 'NAVIGATE',
                errorSignature: obs.message,
              });

              addBugIfUnique({
                id: `bug-${fingerprint.substring(0, 12)}`,
                testRunId: input.testRunId,
                journeyId: journey.journeyId,
                stepId: step.stepId,
                projectId: input.projectId,
                organizationId: input.organizationId,
                type: 'NAVIGATION_FAILURE',
                severity: 'high',
                confidence: 'high',
                status: 'open',
                title: `Navigation failure: ${obs.pageUrl}`,
                summary: obs.message,
                description: `Navigation to target URL "${obs.pageUrl}" failed during user journey "${journey.name}".`,
                url: sanitizeUrl(obs.pageUrl),
                action: 'NAVIGATE',
                errorSignature: obs.message,
                reproductionSteps,
                fingerprint,
                timestamp: obs.timestamp,
                metadata: {
                  journeyName: journey.name,
                },
              });
            }
          }
        }
      }
    }

    // ============================================================================
    // 2. Process Critical Network Failures
    // ============================================================================
    if (input.networkErrors) {
      for (const nErr of input.networkErrors) {
        const assessment = isCriticalNetworkFailure(nErr);
        if (assessment.critical) {
          const sanitizedUrl = sanitizeUrl(nErr.url);
          const errorSig = nErr.errorText || `HTTP ${nErr.status || 500}`;

          const fingerprint = computeBugFingerprint({
            projectId: input.projectId,
            url: sanitizedUrl,
            bugType: 'NETWORK_ERROR',
            action: nErr.method,
            errorSignature: errorSig,
          });

          addBugIfUnique({
            id: `bug-${fingerprint.substring(0, 12)}`,
            testRunId: input.testRunId,
            projectId: input.projectId,
            organizationId: input.organizationId,
            type: 'NETWORK_ERROR',
            severity: (nErr.status && nErr.status >= 500) ? 'high' : 'medium',
            confidence: 'high',
            status: 'open',
            title: `Network failure: ${nErr.method} ${sanitizedUrl}`,
            summary: assessment.reason,
            description: `Network request to "${sanitizedUrl}" failed with status ${nErr.status || 'Failed'}. Error: ${nErr.errorText || 'Unknown'}`,
            url: sanitizedUrl,
            action: nErr.method,
            errorSignature: errorSig,
            reproductionSteps: [
              {
                stepNumber: 1,
                action: 'REQUEST',
                target: `${nErr.method} ${sanitizedUrl}`,
                url: sanitizedUrl,
                expectedBehavior: 'HTTP 200 OK successful response',
                observedBehavior: `HTTP ${nErr.status || 'Failed'} (${nErr.errorText || 'Request failed'})`,
              },
            ],
            fingerprint,
            timestamp: nErr.timestamp || new Date().toISOString(),
            metadata: {
              resourceType: nErr.resourceType,
              status: nErr.status,
            },
          });
        }
      }
    }

    // ============================================================================
    // 3. Process Runtime Console Errors
    // ============================================================================
    if (input.consoleErrors) {
      for (const cErr of input.consoleErrors) {
        const classified = classifyConsoleError(cErr);
        if (classified.isBugCandidate) {
          const sanitizedUrl = sanitizeUrl(cErr.url || input.targetUrl);
          const bugType: BugType =
            classified.category === 'runtime_exception' || classified.category === 'framework_exception'
              ? 'RUNTIME_EXCEPTION'
              : 'CONSOLE_ERROR';

          const fingerprint = computeBugFingerprint({
            projectId: input.projectId,
            url: sanitizedUrl,
            bugType,
            errorSignature: classified.signature,
          });

          addBugIfUnique({
            id: `bug-${fingerprint.substring(0, 12)}`,
            testRunId: input.testRunId,
            projectId: input.projectId,
            organizationId: input.organizationId,
            type: bugType,
            severity: bugType === 'RUNTIME_EXCEPTION' ? 'high' : 'medium',
            confidence: 'high',
            status: 'open',
            title: `Runtime exception: ${classified.signature.substring(0, 60)}`,
            summary: cErr.message,
            description: `Browser uncaught exception detected on ${sanitizedUrl}: ${cErr.message}${cErr.location ? ` at ${cErr.location}` : ''}`,
            url: sanitizedUrl,
            errorSignature: classified.signature,
            reproductionSteps: [
              {
                stepNumber: 1,
                action: 'NAVIGATE',
                target: sanitizedUrl,
                url: sanitizedUrl,
                expectedBehavior: 'Clean page execution without runtime exceptions',
                observedBehavior: `Uncaught exception thrown: ${cErr.message}`,
              },
            ],
            fingerprint,
            timestamp: cErr.timestamp || new Date().toISOString(),
            metadata: {
              location: cErr.location,
              category: classified.category,
            },
          });
        }
      }
    }

    return bugs;
  }

  private buildReproductionSteps(
    priorSteps: JourneyStepExecution[],
    failureMessage: string
  ): StructuredReproductionStep[] {
    const steps: StructuredReproductionStep[] = [];

    priorSteps.forEach((s, idx) => {
      const isLast = idx === priorSteps.length - 1;
      steps.push({
        stepNumber: idx + 1,
        action: s.action,
        target: s.targetDescription,
        url: s.beforeUrl,
        selector: s.selector,
        expectedBehavior: isLast
          ? 'Action completes successfully with expected state update'
          : `Perform ${s.action} on ${s.targetDescription}`,
        observedBehavior: isLast
          ? failureMessage
          : `Completed (${s.status})`,
      });
    });

    return steps;
  }
}
