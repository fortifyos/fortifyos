/**
 * TASK-PBR-001 Verifier — Stable (locked)
 * Baseline: api.types.ts validateAgentRequest()
 */
import { validateAgentRequest, CAPABILITIES, ValidationErrorCodes } from '../src/agents/api.types.ts';

const tests = [
  // Invalid payloads — must reject
  ['null → reject', () => !validateAgentRequest(null).ok],
  ['undefined → reject', () => !validateAgentRequest(undefined).ok],
  ['string → reject', () => !validateAgentRequest('string').ok],
  ['number → reject', () => !validateAgentRequest(123).ok],
  ['empty object → reject', () => !validateAgentRequest({}).ok],
  ['unknown capability → reject', () => !validateAgentRequest({ type: 'UNKNOWN' }).ok],
  ['PROPOSE_ACTION no lease → reject', () => !validateAgentRequest({ type: CAPABILITIES.PROPOSE_ACTION }).ok],
  ['PROPOSE_ACTION empty lease → reject', () => !validateAgentRequest({ type: CAPABILITIES.PROPOSE_ACTION, leaseToken: '' }).ok],
  ['PROPOSE_ACTION no proposal → reject', () => !validateAgentRequest({ type: CAPABILITIES.PROPOSE_ACTION, leaseToken: 'tok' }).ok],
  ['PROPOSE_ACTION null proposal → reject', () => !validateAgentRequest({ type: CAPABILITIES.PROPOSE_ACTION, leaseToken: 'tok', proposal: null }).ok],
  // Valid payloads — must accept
  ['READ_VELOCITY valid', () => validateAgentRequest({ type: CAPABILITIES.READ_VELOCITY }).ok],
  ['READ_RUNWAY valid', () => validateAgentRequest({ type: CAPABILITIES.READ_RUNWAY }).ok],
  ['PROPOSE_ACTION valid', () => validateAgentRequest({ type: CAPABILITIES.PROPOSE_ACTION, leaseToken: 'tok', proposal: { action: 'test' } }).ok],
  // Error codes consistent
  ['PROPOSE_ACTION missing lease → correct code', () => {
    const r = validateAgentRequest({ type: CAPABILITIES.PROPOSE_ACTION });
    return !r.ok && r.code === ValidationErrorCodes.LEASE_TOKEN_MISSING;
  }],
  ['unknown capability → correct code', () => {
    const r = validateAgentRequest({ type: 'FABRICATED' });
    return !r.ok && r.code === ValidationErrorCodes.UNKNOWN_CAPABILITY;
  }],
];

let pass = 0, fail = 0;
for (const [name, fn] of tests) {
  try {
    if (fn()) { console.log(`PASS: ${name}`); pass++; }
    else { console.log(`FAIL: ${name}`); fail++; }
  } catch (e) { console.log(`ERROR: ${name} — ${e.message}`); fail++; }
}
console.log(`\nResults: ${pass}/${pass+fail} passed`);
if (fail > 0) process.exit(1);
