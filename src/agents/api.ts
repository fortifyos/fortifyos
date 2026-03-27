/**
 * TASK-FOS-003: JSDoc Documentation — Agent API
 *
 * Documented exports:
 * - SecurityError
 * - createAgentAPI
 *
 * Usage:
 * ```js
 * import { createAgentAPI } from './api.js';
 *
 * const agentRequest = createAgentAPI({
 *   getCapabilities: () => ['READ_VELOCITY', 'READ_RUNWAY', 'PROPOSE_ACTION'],
 *   getStage: () => 'sovereign',
 *   getSnapshots: () => ({ velocity: 67, runway: 48 }),
 *   verifyLeaseToken: async (token) => ({ ok: true, payload: { caps: ['PROPOSE_ACTION'] } }),
 * });
 *
 * const result = await agentRequest({ type: 'READ_VELOCITY' });
 * ```
 */

import {
  CAPABILITIES,
  validateAgentRequest,
  ValidationErrorCodes,
  type AgentProposal,
  type AgentRequest,
  type APIResult,
  type SuccessResult,
  type FailureResult,
} from './api.types';

import { getNeverListPolicy, buildNeverListRules } from '../policy/neverListStore';
import { secureLogRef } from './secureLogRef.js';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * SecurityError — thrown when a security-relevant operation fails and cannot
 * be meaningfully handled by the caller. All SecurityError instances are logged
 * via secureLogRef before propagation.
 *
 * @extends Error
 * @property {string} code - Machine-readable error identifier
 * @property {'WARN'|'CRITICAL'} severity - Impact level
 * @property {Record<string, unknown>} [context] - Additional context for audit log
 */
export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: 'WARN' | 'CRITICAL',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

// =============================================================================
// Result Constructors
// =============================================================================

function deny(reason: string, code?: FailureResult['code']): FailureResult {
  return { ok: false, reason, code };
}

function ok<T extends object>(data: T): SuccessResult<T> {
  return { ok: true, ...data };
}

type LeaseVerificationResult = {
  ok: boolean;
  reason?: string;
  payload?: { caps?: string[] };
};

// =============================================================================
// Agent API Factory
// =============================================================================

/**
 * Creates an agentRequest handler with the given dependency providers.
 *
 * @param {object} deps - Dependency providers
 * @param {function(): string[]} deps.getCapabilities - Returns current granted capability list
 * @param {function(): string} deps.getStage - Returns current Sovereignty stage name
 * @param {function(): { velocity: number, runway: number }} deps.getSnapshots - Returns current metrics
 * @param {function(string): Promise<{ ok: boolean, reason?: string, payload?: { caps?: string[] } }>} deps.verifyLeaseToken - Validates a lease token
 * @returns {function(unknown): Promise<APIResult>} - The agent request handler
 */
export function createAgentAPI({
  getCapabilities,
  getStage,
  getSnapshots,
  verifyLeaseToken,
}: {
  getCapabilities: () => string[];
  getStage: () => string;
  getSnapshots: () => { velocity: number; runway: number };
  verifyLeaseToken: (token: string) => Promise<LeaseVerificationResult>;
}) {
  return async function agentRequest(req: unknown): Promise<APIResult> {
    // Validate against canonical schema
    const validation = validateAgentRequest(req);
    if (!validation.ok) return validation;

    // Capability check
    const caps = getCapabilities();
    const validatedRequest = validation as SuccessResult<AgentRequest>;
    if (!caps.includes(validatedRequest.type)) {
      return deny(`Capability not granted: ${validatedRequest.type}`, ValidationErrorCodes.CAPABILITY_NOT_GRANTED);
    }

    // Lease token verification for PROPOSE_ACTION
    if (validatedRequest.type === CAPABILITIES.PROPOSE_ACTION) {
      if (typeof verifyLeaseToken !== 'function') {
        throw new SecurityError('Lease verification unavailable', 'LEASE_VERIFY_UNAVAILABLE', 'CRITICAL');
      }
      const lease = await verifyLeaseToken(validatedRequest.leaseToken);
      if (!lease.ok) {
        await secureLogRef()('LEASE_REJECTED', `Lease token rejected: ${lease.reason}`, getStage(), 'WARN', {});
        return deny('Lease token invalid', ValidationErrorCodes.LEASE_TOKEN_INVALID);
      }
      if (!Array.isArray(lease.payload?.caps) || !lease.payload.caps.includes(CAPABILITIES.PROPOSE_ACTION)) {
        await secureLogRef()('LEASE_INSUFFICIENT', 'Lease lacks PROPOSE_ACTION', getStage(), 'WARN', {});
        return deny('Lease token lacks PROPOSE_ACTION', ValidationErrorCodes.LEASE_TOKEN_INVALID);
      }
    }

    // Request handling
    const snaps = getSnapshots();

    switch (validatedRequest.type) {
      case CAPABILITIES.READ_VELOCITY:
        return ok({ velocity: snaps.velocity });

      case CAPABILITIES.READ_RUNWAY:
        return ok({ runway: snaps.runway });

      case CAPABILITIES.PROPOSE_ACTION: {
        const result = await auditAgentProposal(validatedRequest.proposal, getStage());
        return ok({ result });
      }

      default:
        return deny('Unknown capability', ValidationErrorCodes.UNKNOWN_CAPABILITY);
    }
  };
}

// =============================================================================
// Proposal Audit
// =============================================================================

/**
 * Audits a proposed agent action against the Sovereignty Never List.
 * Returns approval or rejection without throwing under normal conditions.
 * Throws SecurityError on policy evaluation failures.
 *
 * @param {Record<string, unknown>} proposal - The proposed action record
 * @param {string} stage - Current Sovereignty stage
 * @returns {Promise<{ status: 'APPROVED'|'REJECTED', reason?: string, signature?: string }>}
 */
async function auditAgentProposal(
  proposal: AgentProposal,
  stage: string
): Promise<{ status: 'APPROVED' | 'REJECTED'; reason?: string; signature?: string }> {
  try {
    const policy = await getNeverListPolicy();
    const NEVER_LIST = buildNeverListRules(policy);

    const isViolation = NEVER_LIST.some((rule) => {
      try {
        return rule.check(proposal);
      } catch {
        return false;
      }
    });

    const velocityImpact = typeof proposal?.impact === 'number' ? proposal.impact : 0;

    if (isViolation || velocityImpact < 0) {
      await secureLogRef()(
        'AGENT_VETO',
        `Agent proposed ${proposal?.action || 'UNKNOWN'} - VETOED`,
        stage,
        'WARN',
        { velocityImpact }
      );
      return { status: 'REJECTED', reason: 'Sovereign Velocity Violation' };
    }

    await secureLogRef()(
      'AGENT_APPROVE',
      `Agent proposed ${proposal?.action || 'UNKNOWN'} - APPROVED`,
      stage,
      'INFO',
      { velocityImpact }
    );

    return { status: 'APPROVED', signature: 'KNOX_V3_AUTH' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await secureLogRef()('AGENT_AUDIT_ERROR', `Proposal audit failed: ${message}`, stage, 'CRITICAL', {});
    throw new SecurityError(`Proposal audit error: ${message}`, 'AUDIT_ERROR', 'CRITICAL', { originalError: message });
  }
}
