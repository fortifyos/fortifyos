import Dexie from 'dexie';

export const db = new Dexie('FortifySovereignDB');

// v1: initial vault tables (3.0.3)
// v2: adds local policy table (Never List editor)
db.version(1).stores({
  auditLog: '++id, timestamp, type, [timestamp+type], stage, severity',
  ingests: '++id, date, merchant, amount, category, status',
  signers: 'id, name, role, lastActive, status',
  macroHistory: 'timestamp, fedLiquidity, btcCycle',
  agents: 'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta: 'id'
});

db.version(2).stores({
  auditLog: '++id, timestamp, type, [timestamp+type], stage, severity',
  ingests: '++id, date, merchant, amount, category, status',
  signers: 'id, name, role, lastActive, status',
  macroHistory: 'timestamp, fedLiquidity, btcCycle',
  agents: 'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta: 'id',
  policy: 'id'
});

db.version(3).stores({
  auditLog: '++id, seq, timestamp, type, [timestamp+type], stage, severity',
  ingests: '++id, date, merchant, amount, category, status',
  signers: 'id, name, role, lastActive, status',
  macroHistory: 'timestamp, fedLiquidity, btcCycle',
  agents: 'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta: 'id',
  policy: 'id'
});

// v4: vault epoch + lineage binding (epochId) stored per event
db.version(4).stores({
  auditLog: '++id, seq, epochId, timestamp, type, [timestamp+type], stage, severity',
  ingests: '++id, date, merchant, amount, category, status',
  signers: 'id, name, role, lastActive, status',
  macroHistory: 'timestamp, fedLiquidity, btcCycle',
  agents: 'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta: 'id',
  policy: 'id'
});

export async function saveCryptoMeta(meta) {
  await db.cryptoMeta.put({ id: 'primary', ...meta });
}

export async function getCryptoMeta() {
  return await db.cryptoMeta.get('primary');
}
