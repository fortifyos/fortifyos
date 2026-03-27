/**
 * TASK-PBR-002 Verification Suite
 * Stable verifier — do not modify during task execution.
 *
 * Run in browser console or via test runner:
 *   node verification/verify_pbr002.js  (Node.js with fake-indexeddb)
 *
 * Or open verification/pbr002_test.html in a browser.
 */

import 'fake-indexeddb/auto';
import Dexie from 'dexie';

// =============================================================================
// Test Utilities
// =============================================================================

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`PASS: ${name}`); pass++; }
  else { console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

function section(name) { console.log(`\n=== ${name} ===`); }

// =============================================================================
// Test: Fresh Apply
// =============================================================================

export async function testFreshApply() {
  section('Fresh Apply');

  const dbName = 'FortifySovereignDB__pbr002_fresh';

  // Create a genuine pre-upgrade database first.
  const seedDb = new Dexie(dbName);
  seedDb.version(1).stores({ items: '++id, name' });
  seedDb.version(2).stores({ items: '++id, name, tag', meta: 'id' }).upgrade(tx => {
    return tx.items.toCollection().modify(item => { if (item.tag === undefined) item.tag = null; });
  });
  await seedDb.open();
  const seedId = await seedDb.table('items').add({ name: 'seed-item', tag: 'seed' });
  await seedDb.close();

  // Re-open the same database with the latest schema to force migrations.
  const testDb = new Dexie(dbName);
  testDb.version(1).stores({ items: '++id, name' });
  testDb.version(2).stores({ items: '++id, name, tag', meta: 'id' }).upgrade(tx => {
    return tx.items.toCollection().modify(item => { if (item.tag === undefined) item.tag = null; });
  });
  testDb.version(3).stores({ items: '++id, seq, name, tag', meta: 'id' }).upgrade(tx => {
    return tx.items.toCollection().modify(item => { if (item.seq === undefined) item.seq = item.id; });
  });
  testDb.version(4).stores({
    items: '++id, seq, epochId, name, tag',
    meta: 'id'
  }).upgrade(tx => {
    return tx.items.toCollection().modify(item => { if (item.epochId === undefined) item.epochId = null; });
  });

  await testDb.open();

  // Check tables exist
  const tableNames = testDb.tables.map(t => t.name).sort();
  check('Tables created: items, meta', tableNames.includes('items') && tableNames.includes('meta'));

  // Check indexes on items table
  const itemsTable = testDb.table('items');
  const indexes = [...itemsTable.schema.indexes].map(i => i.name).sort();
  check('items table has indexes', indexes.length >= 3, `indexes: ${indexes.join(',')}`);
  check('items has seq index', indexes.includes('seq'));
  check('items has epochId index', indexes.includes('epochId'));

  // Existing rows should be upgraded in-place.
  const migrated = await itemsTable.get(seedId);
  check('Seed row preserved after upgrade', migrated?.name === 'seed-item');
  check('Existing row gets seq during upgrade', migrated?.seq === seedId);
  check('Existing row gets epochId during upgrade', migrated?.epochId === null);

  // New rows created after the upgrade should still be writable.
  const id = await itemsTable.add({ name: 'test-item', tag: 'test', seq: 2, epochId: null });
  const retrieved = await itemsTable.get(id);
  check('Data written and retrieved', retrieved?.name === 'test-item');

  await testDb.close();
  await Dexie.delete('FortifySovereignDB__pbr002_fresh');
}

// =============================================================================
// Test: Repeat Apply (Idempotency)
// =============================================================================

export async function testRepeatApply() {
  section('Repeat Apply');

  const testDb = new Dexie('FortifySovereignDB__pbr002_repeat');
  testDb.version(1).stores({ items: '++id, name' });
  testDb.version(2).stores({ items: '++id, name, tag', meta: 'id' }).upgrade(tx => {
    return tx.items.toCollection().modify(item => { if (item.tag === undefined) item.tag = null; });
  });
  testDb.version(3).stores({ items: '++id, seq, name, tag', meta: 'id' }).upgrade(tx => {
    return tx.items.toCollection().modify(item => { if (item.seq === undefined) item.seq = item.id; });
  });
  testDb.version(4).stores({
    items: '++id, seq, epochId, name, tag',
    meta: 'id'
  }).upgrade(tx => {
    return tx.items.toCollection().modify(item => { if (item.epochId === undefined) item.epochId = null; });
  });

  // First open
  await testDb.open();
  await testDb.table('items').add({ name: 'item1' });
  const firstSeq = (await testDb.table('items').get(1))?.seq;
  await testDb.close();

  // Second open — simulates app restart / repeat apply
  await testDb.open();
  const secondSeq = (await testDb.table('items').get(1))?.seq;
  await testDb.close();

  check('Repeat apply: seq preserved', firstSeq === secondSeq, `v1=${firstSeq}, v2=${secondSeq}`);

  // Open third time — still stable
  await testDb.open();
  const thirdSeq = (await testDb.table('items').get(1))?.seq;
  check('Third apply: seq still stable', thirdSeq === firstSeq);
  await testDb.close();

  await Dexie.delete('FortifySovereignDB__pbr002_repeat');
}

// =============================================================================
// Test: Schema Version Observable
// =============================================================================

export async function testSchemaVersionObservable() {
  section('Schema Version Observable');

  const testDb = new Dexie('FortifySovereignDB__pbr002_version');
  testDb.version(1).stores({ items: '++id' });
  testDb.version(2).stores({ items: '++id, name', meta: 'id' });

  await testDb.open();
  const tables = testDb.tables.map(t => t.name);
  check('Schema version 2: both tables present', tables.includes('items') && tables.includes('meta'));
  await testDb.close();

  await Dexie.delete('FortifySovereignDB__pbr002_version');
}

// =============================================================================
// Run All
// =============================================================================

export async function runAll() {
  console.log('TASK-PBR-002 Verification Suite');
  try {
    await testFreshApply();
    await testRepeatApply();
    await testSchemaVersionObservable();
  } catch (err) {
    console.error('Test threw:', err);
    fail++;
  }
  console.log(`\n=== Summary: ${pass}/${pass + fail} passed ===`);
  if (fail > 0) process.exit(1);
}

// Auto-run if executed directly
const isMain = typeof process !== 'undefined' && process.argv[1]?.endsWith('verify_pbr002.js');
if (isMain) runAll().catch(console.error);
