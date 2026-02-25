function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const v = obj[prop];
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  });
  return obj;
}

export async function buildAgentHandshake({ stage, posture, permissions, runway }) {
  const proofOfSolvency = '0xproof_stub_' + String(Date.now());

  const manifest = {
    version: '3.0',
    posture,
    stage,
    permissions,
    restrictions: [
      'BLOCK_EXTERNAL_TRANSFERS',
      'ENFORCE_NEVER_LIST',
      'NO_BANK_ACCOUNT_NUMBERS',
      'NO_SEED_PHRASES'
    ],
    runway,
    proofOfSolvency
  };

  return deepFreeze(manifest);
}
