const enc = new TextEncoder();

function b64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

async function sha256(dataBytes) {
  const hash = await crypto.subtle.digest('SHA-256', dataBytes);
  return new Uint8Array(hash);
}

function stableStringify(obj) {
  // Stable key ordering for deterministic hashing
  const allKeys = [];
  JSON.stringify(obj, (k, v) => (allKeys.push(k), v));
  allKeys.sort();
  return JSON.stringify(obj, allKeys);
}

export async function computeEventHash({ epochId, prevHashB64, seq, timestamp, type, stage, severity, ivB64, payloadB64 }) {
  const body = stableStringify({ epochId, prevHashB64, seq, timestamp, type, stage, severity, ivB64, payloadB64 });
  const bytes = enc.encode(body);
  const h = await sha256(bytes);
  return b64(h);
}

export async function verifyAuditChain(events) {
  // events must be ordered oldest -> newest
  let prev = 'GENESIS';
  let expectedSeq = 1;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    // Monotonic counter check (anti-rollback/tamper)
    if (typeof e.seq !== 'number' || e.seq !== expectedSeq) {
      return { ok: false, index: i, reason: `Sequence break: expected ${expectedSeq}, got ${e.seq}` };
    }

    const computed = await computeEventHash({
      epochId: e.epochId,
      prevHashB64: prev,
      seq: e.seq,
      timestamp: e.timestamp,
      type: e.type,
      stage: e.stage,
      severity: e.severity,
      ivB64: e.ivB64,
      payloadB64: e.payloadB64
    });

    if (computed !== e.hashB64) {
      return { ok: false, index: i, reason: 'Hash mismatch' };
    }

    prev = e.hashB64;
    expectedSeq += 1;
  }

  return { ok: true, tip: prev, count: events.length };
}
