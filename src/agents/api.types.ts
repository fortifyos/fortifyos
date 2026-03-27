/**
 * Pattern Blue Agent API — TypeScript Validation Layer
 * TASK-PBR-001: API Input Validation
 *
 * Canonical input contracts for all API requests.
 * Enforces deterministic rejection of malformed input.
 */

export const CAPABILITIES = Object.freeze({
  READ_VELOCITY: 'READ_VELOCITY',
  READ_RUNWAY: 'READ_RUNWAY',
  PROPOSE_ACTION: 'PROPOSE_ACTION',
} as const);

export type CapabilityType = typeof CAPABILITIES[keyof typeof CAPABILITIES];

export const ValidationErrorCodes = Object.freeze({
  INVALID_REQUEST_SHAPE: 'INVALID_REQUEST_SHAPE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',
  UNKNOWN_CAPABILITY: 'UNKNOWN_CAPABILITY',
  CAPABILITY_NOT_GRANTED: 'CAPABILITY_NOT_GRANTED',
  LEASE_TOKEN_INVALID: 'LEASE_TOKEN_INVALID',
  LEASE_TOKEN_MISSING: 'LEASE_TOKEN_MISSING',
  PROPOSAL_INVALID: 'PROPOSAL_INVALID',
} as const);

export type ValidationErrorCode = typeof ValidationErrorCodes[keyof typeof ValidationErrorCodes];

export interface SuccessResult<T = unknown> {
  ok: true;
  [key: string]: T;
}

export interface FailureResult {
  ok: false;
  reason: string;
  code?: ValidationErrorCode;
}

export type APIResult<T = unknown> = SuccessResult<T> | FailureResult;

export interface AgentProposal {
  action?: string;
  impact?: number;
  [key: string]: unknown;
}

// =============================================================================
// Validators
// =============================================================================

export function validateAgentRequest(req: unknown): APIResult {
  if (req === null || req === undefined) {
    return { ok: false, reason: 'Request is null or undefined', code: ValidationErrorCodes.INVALID_REQUEST_SHAPE };
  }
  if (typeof req !== 'object') {
    return { ok: false, reason: 'Request must be an object', code: ValidationErrorCodes.INVALID_REQUEST_SHAPE };
  }

  const r = req as Record<string, unknown>;

  if (!('type' in r)) {
    return { ok: false, reason: 'Missing required field: type', code: ValidationErrorCodes.MISSING_REQUIRED_FIELD };
  }
  if (typeof r.type !== 'string') {
    return { ok: false, reason: 'Field "type" must be a string', code: ValidationErrorCodes.INVALID_FIELD_TYPE };
  }

  const validTypes = Object.values(CAPABILITIES);
  if (!validTypes.includes(r.type as CapabilityType)) {
    return { ok: false, reason: `Unknown capability: ${r.type}`, code: ValidationErrorCodes.UNKNOWN_CAPABILITY };
  }

  const type = r.type as CapabilityType;

  // Capability-specific validation
  if (type === CAPABILITIES.PROPOSE_ACTION) {
    if (!('leaseToken' in r) || typeof r.leaseToken !== 'string' || r.leaseToken.trim() === '') {
      return { ok: false, reason: 'Missing or invalid field: leaseToken', code: ValidationErrorCodes.LEASE_TOKEN_MISSING };
    }
    if (!('proposal' in r) || typeof r.proposal !== 'object' || r.proposal === null) {
      return { ok: false, reason: 'Missing or invalid field: proposal', code: ValidationErrorCodes.PROPOSAL_INVALID };
    }
  }

  return { ok: true, type };
}
