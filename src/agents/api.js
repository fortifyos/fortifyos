import { getNeverListPolicy, buildNeverListRules } from '../policy/neverListStore';
import { secureLogRef } from './secureLogRef';

export const CAPABILITIES = Object.freeze({
  READ_VELOCITY: 'READ_VELOCITY',
  READ_RUNWAY: 'READ_RUNWAY',
  PROPOSE_ACTION: 'PROPOSE_ACTION'
});

function deny(reason) { return { ok: false, reason }; }

export function createAgentAPI({ getCapabilities, getStage, getSnapshots, verifyLeaseToken }) {
  return async function agentRequest(req) {
    const caps = getCapabilities();
    const stage = getStage();

    if (!req || typeof req !== 'object') return deny('Bad request');
    if (!req.type) return deny('Missing type');
    if (!caps.includes(req.type)) return deny('Capability not granted');

    // Lease token gate (anti-replay / agent authorization)
    // Required for proposal actions.
    if (req.type === CAPABILITIES.PROPOSE_ACTION) {
      if (typeof verifyLeaseToken !== 'function') return deny('Lease verification unavailable');
      const lease = await verifyLeaseToken(req.leaseToken);
      if (!lease.ok) return deny(`Lease token invalid: ${lease.reason}`);
      if (!Array.isArray(lease.payload?.caps) || !lease.payload.caps.includes(CAPABILITIES.PROPOSE_ACTION)) {
        return deny('Lease token lacks PROPOSE_ACTION');
      }
    }

    const snaps = getSnapshots();

    switch (req.type) {
      case CAPABILITIES.READ_VELOCITY:
        return { ok: true, velocity: snaps.velocity };
      case CAPABILITIES.READ_RUNWAY:
        return { ok: true, runway: snaps.runway };
      case CAPABILITIES.PROPOSE_ACTION: {
        const result = await auditAgentProposal(req.proposal, stage);
        return { ok: true, result };
      }
      default:
        return deny('Unknown capability');
    }
  };
}

function calculateImpact(proposal) {
  // Placeholder: negative impact indicates higher burn / lower runway.
  return typeof proposal?.impact === 'number' ? proposal.impact : 0;
}

export async function auditAgentProposal(proposal, stage) {
  const policy = await getNeverListPolicy();
  const NEVER_LIST = buildNeverListRules(policy);
  const isViolation = NEVER_LIST.some(rule => rule.check(proposal));
  const velocityImpact = calculateImpact(proposal);

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
}
