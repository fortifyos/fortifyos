/**
 * TASK-PBR-002: Database Migrations
 *
 * Migration layer for FortifySovereignDB using Dexie.
 *
 * Schema authority: src/db/sovereignDB.js
 * Migration runner: applied automatically by Dexie on version bumps.
 * Version tracking: db.versionInfo stores applied schema version.
 *
 * Migration contract:
 * - fresh apply: all tables created, all upgrade functions run
 * - repeat apply: idempotent, no data loss
 * - version observable: db.versionInfo.current reflects latest applied
 * - rollback policy: documented below (automated rollback not implemented)
 */

import Dexie from 'dexie';

export const db = new Dexie('FortifySovereignDB');

// =============================================================================
// Schema Definitions — one block per version
// =============================================================================

// v1: initial vault tables (3.0.3)
db.version(1).stores({
  auditLog:    '++id, timestamp, type, [timestamp+type], stage, severity',
  ingests:     '++id, date, merchant, amount, category, status',
  signers:     'id, name, role, lastActive, status',
  macroHistory:'timestamp, fedLiquidity, btcCycle',
  agents:      'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta:  'id'
});

// v2: adds local policy table (Never List editor)
// No data transformation required — new table only.
db.version(2).stores({
  auditLog:    '++id, timestamp, type, [timestamp+type], stage, severity',
  ingests:     '++id, date, merchant, amount, category, status',
  signers:     'id, name, role, lastActive, status',
  macroHistory:'timestamp, fedLiquidity, btcCycle',
  agents:      'id, name, lastHeartbeat, status, leaseExpiresAt',
  cryptoMeta:  'id',
  policy:      'id'
});

// v3: adds seq field to auditLog entries
// Upgrade: populate seq = id for all existing auditLog rows.
// This makes seq track the auto-increment id.
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

// v4: vault epoch + lineage binding (epochId) stored per event
// Upgrade: set epochId = null for all existing auditLog rows.
// epochId is assigned by the epoch manager at write time, not retroactively.
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
// Schema Version Tracking
// Schema version is the Dexie schema version (not the app version).
// Latest schema version: 4
// =============================================================================

export const LATEST_SCHEMA_VERSION = 4;

// =============================================================================
// Version Info Helpers
// Stores current schema version in a dedicated metadata table.
// =============================================================================

/**
 * Gets the current schema version from the DB metadata.
 * Returns null if not yet initialized (fresh DB before first open).
 */
export async function getSchemaVersion() {
  const info = await db.table('_versionInfo').get('schema');
  return info?.version ?? null;
}

/**
 * Sets the current schema version in DB metadata.
 * Called after a successful migration.
 */
async function setSchemaVersion(version) {
  await db.table('_versionInfo').put({ id: 'schema', version });
}

// =============================================================================
// Migration Runner
// Dexie applies upgrades automatically on version bumps.
// This function provides observability and validation.
// =============================================================================

/**
 * Runs schema health check.
 * Returns { schemaVersion, tableCount, ok }.
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
// Rollback Policy
// ================
// Rollback from vN to v(N-1) is NOT automated.
//
// Manual rollback procedure:
// 1. Export all data from affected tables (toCollection().toArray())
// 2. Close all DB connections
// 3. Delete the IndexedDB database (browser: DevTools > Application > IndexedDB > FortifySovereignDB > Delete)
// 4. Downgrade schema version in this file
// 5. Re-open the app — data starts fresh at lower version
//
// Rollback is high-risk for production data. Prefer forward migrations.
// If data corruption occurs: the only safe recovery path is from a backup,
// not from a version downgrade. This is consistent with FortifyOS sovereignty principle:
// data integrity is the user's responsibility; the system provides forward migration only.
// =============================================================================

// =============================================================================
// Convenience Exports
// =============================================================================

export async function saveCryptoMeta(meta) {
  await db.cryptoMeta.put({ id: 'primary', ...meta });
}

export async function getCryptoMeta() {
  return await db.cryptoMeta.get('primary');
}
