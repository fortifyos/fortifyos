/**
 * TASK-FOS-003: JSDoc Documentation — API Types and Validation
 *
 * Documented exports:
 * - CAPABILITIES, CapabilityType
 * - ValidationErrorCodes, ValidationErrorCode
 * - SuccessResult, FailureResult, APIResult
 * - AgentProposal
 * - validateAgentRequest
 */

/** Recognized capability types for agent requests. */
export const CAPABILITIES = Object.freeze({
  /** Read the current Sovereignty Velocity metric. */
  READ_VELOCITY: 'READ_VELOCITY',
  /** Read the current Runway metric. */
  READ_RUNWAY: 'READ_RUNWAY',
  /** Submit a proposed agent action for audit and veto review. */
  PROPOSE_ACTION: 'PROPOSE_ACTION',
} as const);

/** @type {string} */
export type CapabilityType = typeof CAPABILITIES[keyof typeof CAPABILITIES];

/** Error codes returned on validation failure. */
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

/** @type {string} */
export type ValidationErrorCode = typeof ValidationErrorCodes[keyof typeof ValidationErrorCodes];

/**
 * Success response envelope.
 * @template T
 */
export type SuccessResult<T extends object = {}> = { ok: true } & T;

/**
 * Failure response envelope.
 * @property {false} ok
 * @property {string} reason - Human-readable reason for rejection
 * @property {ValidationErrorCode} [code] - Machine-readable error code
 */
export interface FailureResult {
  ok: false;
  reason: string;
  code?: ValidationErrorCode;
}

/** @template T */
export type APIResult<T extends object = {}> = SuccessResult<T> | FailureResult;

/**
 * An agent-proposed action submitted for Sovereignty audit.
 * @property {string} [action] - Named action being proposed
 * @property {number} [impact] - Estimated velocity impact (-100 to +100)
 */
export interface AgentProposal {
  action?: string;
  impact?: number;
  [key: string]: unknown;
}

export interface ReadVelocityRequest {
  type: typeof CAPABILITIES.READ_VELOCITY;
}

export interface ReadRunwayRequest {
  type: typeof CAPABILITIES.READ_RUNWAY;
}

export interface ProposeActionRequest {
  type: typeof CAPABILITIES.PROPOSE_ACTION;
  leaseToken: string;
  proposal: AgentProposal;
}

export type AgentRequest = ReadVelocityRequest | ReadRunwayRequest | ProposeActionRequest;

/**
 * Validates an incoming agent API request against known capability schemas.
 * Returns a typed SuccessResult on valid requests, FailureResult on all failures.
 *
 * Validation rules:
 * - Request must be a non-null object
 * - 'type' field must be present and a known CapabilityType
 * - PROPOSE_ACTION requires leaseToken (non-empty string) and proposal (object)
 * - All other capability types require no additional fields
 *
 * @param {unknown} req - The raw incoming request
 * @returns {APIResult<AgentRequest>} - SuccessResult (with validated request payload) or FailureResult with code
 */
export function validateAgentRequest(req: unknown): APIResult<AgentRequest> {
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

  if (type === CAPABILITIES.PROPOSE_ACTION) {
    return {
      ok: true,
      type,
      leaseToken: r.leaseToken as string,
      proposal: r.proposal as AgentProposal,
    };
  }

  return { ok: true, type };
}
