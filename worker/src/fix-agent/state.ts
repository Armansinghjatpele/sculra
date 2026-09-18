// ==============================================================================
// Sculra Fix Agent State Machine (worker/src/fix-agent/state.ts)
// ==============================================================================

import { FixAgentState } from './types';
import { FixAgentError } from './errors';

export interface StateTransitionRecord {
  fromState: FixAgentState;
  toState: FixAgentState;
  timestamp: string;
  actor: string;
  reason?: string;
  metadata?: Record<string, any>;
}

const ALLOWED_TRANSITIONS: Record<FixAgentState, FixAgentState[]> = {
  REQUESTED: ['AUTHORIZED', 'BLOCKED', 'CANCELLED', 'FAILED'],
  AUTHORIZED: ['DIAGNOSIS_VALIDATED', 'BLOCKED', 'CANCELLED', 'FAILED'],
  DIAGNOSIS_VALIDATED: ['CONTEXT_COLLECTED', 'BLOCKED', 'CANCELLED', 'FAILED'],
  CONTEXT_COLLECTED: ['PATCH_GENERATED', 'BLOCKED', 'CANCELLED', 'FAILED'],
  PATCH_GENERATED: ['PATCH_VALIDATED', 'BLOCKED', 'CANCELLED', 'FAILED'],
  PATCH_VALIDATED: ['WORKSPACE_CREATED', 'VERIFIED', 'BLOCKED', 'CANCELLED', 'FAILED'],
  WORKSPACE_CREATED: ['BASELINE_VERIFIED', 'ROLLED_BACK', 'CANCELLED', 'FAILED'],
  BASELINE_VERIFIED: ['PATCH_APPLIED', 'ROLLED_BACK', 'CANCELLED', 'FAILED'],
  PATCH_APPLIED: ['DIFF_REVIEWED', 'ROLLED_BACK', 'CANCELLED', 'FAILED'],
  DIFF_REVIEWED: ['VERIFICATION_RUNNING', 'ROLLED_BACK', 'BLOCKED', 'CANCELLED', 'FAILED'],
  VERIFICATION_RUNNING: ['VERIFIED', 'ROLLED_BACK', 'FAILED', 'CANCELLED'],
  VERIFIED: ['BRANCH_CREATED', 'ROLLED_BACK', 'FAILED'],
  BRANCH_CREATED: ['PR_CREATED', 'ROLLED_BACK', 'FAILED'],
  PR_CREATED: [], // Terminal
  ROLLED_BACK: ['FAILED', 'CANCELLED'],
  FAILED: [],     // Terminal
  BLOCKED: [],    // Terminal
  CANCELLED: [],  // Terminal
};

export class FixAgentStateMachine {
  private _currentState: FixAgentState;
  private _history: StateTransitionRecord[] = [];
  public readonly remediationId: string;

  constructor(initialState: FixAgentState = 'REQUESTED', remediationId = 'unknown') {
    this._currentState = initialState;
    this.remediationId = remediationId;
  }

  get currentState(): FixAgentState {
    return this._currentState;
  }

  get history(): ReadonlyArray<StateTransitionRecord> {
    return this._history;
  }

  /**
   * Evaluates if a transition from currentState to targetState is valid.
   */
  canTransitionTo(targetState: FixAgentState): boolean {
    const allowed = ALLOWED_TRANSITIONS[this._currentState] || [];
    return allowed.includes(targetState);
  }

  /**
   * Executes a state transition with validation and audit trail.
   */
  transition(
    targetState: FixAgentState,
    actor = 'system',
    reason?: string,
    metadata?: Record<string, any>
  ): StateTransitionRecord {
    if (!this.canTransitionTo(targetState)) {
      throw new FixAgentError(
        `Invalid state transition: Cannot transition from ${this._currentState} to ${targetState}`,
        'INVALID_STATE_TRANSITION',
        this.remediationId
      );
    }

    const record: StateTransitionRecord = {
      fromState: this._currentState,
      toState: targetState,
      timestamp: new Date().toISOString(),
      actor,
      reason,
      metadata,
    };

    this._history.push(record);
    this._currentState = targetState;
    return record;
  }
}
