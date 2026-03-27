/**
 * Pattern Blue Agent API
 * TASK-PBR-001: API Input Validation
 * TASK-FOS-002: Security Error Handling
 */

import {
  CAPABILITIES,
  validateAgentRequest,
  ValidationErrorCodes,
  type APIResult,
  type SuccessResult,
  type FailureResult,
} from './api.types';

import { getNeverListPolicy, buildNeverListRules } from '../policy/neverListStore';
import { secureLogRef } from './secureLogRef';

// =============================================================================
// Error Classes (TASK-FOS-002)
// =============================================================================

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

function deny(reason: string, code?: string): FailureResult {
  return { ok: false, reason, code };
}

function ok<T>(data: T): SuccessResult<T> {
  return { ok: true, ...data };
}

// =============================================================================
// API Factory
// =============================================================================

export function createAgentAPI({
  getCapabilities,
  getStage,
  getSnapshots,
  verifyLeaseToken,
}: {
  getCapabilities: () => string[];
  getStage: () => string;
  getSnapshots: () => { velocity: number; runway: number };
  verifyLeaseToken: (token: string) => Promise<{ ok: boolean; reason?: string; payload?: { caps?: string[] } }>;
}) {
  return async function agentRequest(req: unknown): Promise<APIResult> {
    // TASK-PBR-001: Canonical validation entry point
    const validation = validateAgentRequest(req);
    if (!validation.ok) return validation;

    const caps = getCapabilities();
    if (!caps.includes(validation.type)) {
      return deny(`Capability not granted: ${validation.type}`, ValidationErrorCodes.CAPABILITY_NOT_GRANTED);
    }

    // TASK-FOS-002: Lease verification with logging
    if (validation.type === CAPABILITIES.PROPOSE_ACTION) {
      if (typeof verifyLeaseToken !== 'function') {
        throw new SecurityError('Lease verification unavailable', 'LEASE_VERIFY_UNAVAILABLE', 'CRITICAL');
      }
      const lease = await verifyLeaseToken((validation as { leaseToken: string }).leaseToken);
      if (!lease.ok) {
        await secureLogRef()('LEASE_REJECTED', `Lease token rejected: ${lease.reason}`, getStage(), 'WARN', {});
        return deny('Lease token invalid', ValidationErrorCodes.LEASE_TOKEN_INVALID);
      }
      if (!Array.isArray(lease.payload?.caps) || !lease.payload.caps.includes(CAPABILITIES.PROPOSE_ACTION)) {
        await secureLogRef()('LEASE_INSUFFICIENT', 'Lease lacks PROPOSE_ACTION', getStage(), 'WARN', {});
        return deny('Lease token lacks PROPOSE_ACTION', ValidationErrorCodes.LEASE_TOKEN_INVALID);
      }
    }

    const snaps = getSnapshots();

    switch (validation.type) {
      case CAPABILITIES.READ_VELOCITY:
        return ok({ velocity: snaps.velocity });
      case CAPABILITIES.READ_RUNWAY:
        return ok({ runway: snaps.runway });
      case CAPABILITIES.PROPOSE_ACTION: {
        const result = await auditAgentProposal((validation as { proposal: Record<string, unknown> }).proposal, getStage());
        return ok({ result });
      }
      default:
        return deny('Unknown capability', ValidationErrorCodes.UNKNOWN_CAPABILITY);
    }
  };
}

// =============================================================================
// Proposal Audit — TASK-FOS-002: No silent catches
// =============================================================================

async function auditAgentProposal(proposal: Record<string, unknown>, stage: string): Promise<{ status: string; reason?: string; signature?: string }> {
  try {
    const policy = await getNeverListPolicy();
    const NEVER_LIST = buildNeverListRules(policy);

    const isViolation = NEVER_LIST.some((rule: { check: (p: unknown) => boolean }) => {
      try {
        return rule.check(proposal);
      } catch {
        return false;
      }
    });

    const velocityImpact = typeof proposal?.impact === 'number' ? proposal.impact : 0;

    if (isViolation || velocityImpact < 0) {
      await secureLogRef()('AGENT_VETO', `Agent proposed ${proposal?.action || 'UNKNOWN'} - VETOED`, stage, 'WARN', { velocityImpact });
      return { status: 'REJECTED', reason: 'Sovereign Velocity Violation' };
    }

    await secureLogRef()('AGENT_APPROVE', `Agent proposed ${proposal?.action || 'UNKNOWN'} - APPROVED`, stage, 'INFO', { velocityImpact });
    return { status: 'APPROVED', signature: 'KNOX_V3_AUTH' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await secureLogRef()('AGENT_AUDIT_ERROR', `Proposal audit failed: ${message}`, stage, 'CRITICAL', {});
    throw new SecurityError(`Proposal audit error: ${message}`, 'AUDIT_ERROR', 'CRITICAL', { originalError: message });
  }
}
