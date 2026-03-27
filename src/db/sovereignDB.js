/**
 * TASK-FOS-003: JSDoc Documentation — Database Layer
 *
 * Documented exports:
 * - db (Dexie instance), LATEST_SCHEMA_VERSION, getSchemaHealth,
 *   saveCryptoMeta, getCryptoMeta
 *
 * Rollback Policy:
 *   Automated rollback is NOT implemented. To roll back:
 *   1. Export all data from affected tables (toCollection().toArray())
 *   2. Close all DB connections
 *   3. Delete the IndexedDB database
 *   4. Downgrade schema version in this file
 *   5. Re-open the app — fresh at lower version
 *   Rollback is high-risk for production data. Prefer forward migrations.
 */

import Dexie from 'dexie';

export const db = new Dexie('FortifySovereignDB');

// =============================================================================
// Schema Definitions — one block per version
// =============================================================================

/**
 * v1: initial vault tables (3.0.3)
 * Tables: auditLog, ingests, signers, macroHistory, agents, cryptoMeta
 */
db.version(1).stores({
  auditLog:    '++id, timestamp, type, [timestamp+type], stage, severity',
  ingests:     '++id, date, merchant, amount, category, status',
  signers:     'id, name, role, lastActive, status',
  macroHistory:'timestamp, fedLiquidity, btcCycle',
  agents:      'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta:  'id'
});

/**
 * v2: adds local policy table (Never List editor)
 * No data transformation — new table only.
 */
db.version(2).stores({
  auditLog:    '++id, timestamp, type, [timestamp+type], stage, severity',
  ingests:     '++id, date, merchant, amount, category, status',
  signers:     'id, name, role, lastActive, status',
  macroHistory:'timestamp, fedLiquidity, btcCycle',
  agents:      'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta:  'id',
  policy:      'id'
});

/**
 * v3: adds seq index to auditLog
 * Upgrade: sets seq = id for all existing auditLog rows.
 */
db.version(3).stores({
  auditLog:    '++id, seq, timestamp, type, [timestamp+type], stage, severity',
  ingests:     '++id, date, merchant, amount, category, status',
  signers:     'id, name, role, lastActive, status',
  macroHistory:'timestamp, fedLiquidity, btcCycle',
  agents:      'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta:  'id',
  policy:      'id'
}).upgrade(tx => {
  return tx.table('auditLog').toCollection().modify(row => {
    if (row.seq === undefined) row.seq = row.id;
  });
});

/**
 * v4: adds epochId index to auditLog (vault epoch + lineage binding)
 * Upgrade: sets epochId = null for all existing auditLog rows.
 * epochId is assigned by the epoch manager at write time, not retroactively.
 */
db.version(4).stores({
  auditLog:    '++id, seq, epochId, timestamp, type, [timestamp+type], stage, severity',
  ingests:     '++id, date, merchant, amount, category, status',
  signers:     'id, name, role, lastActive, status',
  macroHistory:'timestamp, fedLiquidity, btcCycle',
  agents:      'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta:  'id',
  policy:      'id'
}).upgrade(tx => {
  return tx.table('auditLog').toCollection().modify(row => {
    if (row.epochId === undefined) row.epochId = null;
  });
});

// =============================================================================
// Schema Version
// =============================================================================

/**
 * The current schema version. Increment when adding a new db.version() block.
 * @type {number}
 */
export const LATEST_SCHEMA_VERSION = 4;

// =============================================================================
// Schema Health
// =============================================================================

/**
 * Returns a snapshot of the current schema state.
 * Use for diagnostics and version reporting.
 *
 * @returns {Promise<{ schemaVersion: number, tableCount: number, tables: string[], ok: boolean }>}
 */
export async function getSchemaHealth() {
  const schemaVersion = LATEST_SCHEMA_VERSION;
  const tableNames = db.tables.map(t => t.name).filter(n => n !== '_versionInfo');
  return {
    schemaVersion,
    tableCount: tableNames.length,
    tables: tableNames,
    ok: true
  };
}

// =============================================================================
// Crypto Metadata Helpers
// =============================================================================

/**
 * Saves the primary crypto metadata object.
 * Overwrites any existing record at id='primary'.
 *
 * @param {object} meta - Crypto metadata to store
 * @returns {Promise<void>}
 */
export async function saveCryptoMeta(meta) {
  await db.cryptoMeta.put({ id: 'primary', ...meta });
}

/**
 * Retrieves the primary crypto metadata object.
 *
 * @returns {Promise<object|undefined>}
 */
export async function getCryptoMeta() {
  return await db.cryptoMeta.get('primary');
}
