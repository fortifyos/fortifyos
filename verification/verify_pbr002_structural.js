/**
 * TASK-PBR-002 — Structural Verification (Node.js, no browser)
 * Checks schema structure without running IndexedDB.
 */

import { readFileSync } from 'fs';

const src = readFileSync('./src/db/sovereignDB.js', 'utf8');

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`PASS: ${name}`); pass++; }
  else { console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

console.log('=== TASK-PBR-002 Structural Verification ===\n');

// 1. Schema versions present
[1, 2, 3, 4].forEach(v => {
  check(`Version ${v} defined`, src.includes(`db.version(${v})`));
});

// 2. LATEST_SCHEMA_VERSION = 4
check('LATEST_SCHEMA_VERSION = 4', src.includes('LATEST_SCHEMA_VERSION = 4'));

// 3. Upgrade functions for v3 and v4 (data migrations)
check('v3 upgrade: seq field migration', src.includes('row.seq = row.id') && src.includes('v3'));
check('v4 upgrade: epochId field migration', src.includes('row.epochId = null') && src.includes('v4'));

// 4. Rollback policy documented
check('Rollback policy documented', src.includes('Rollback Policy') && src.includes('NOT implemented'));

// 5. saveCryptoMeta and getCryptoMeta exported
check('saveCryptoMeta exported', src.includes('export async function saveCryptoMeta'));
check('getCryptoMeta exported', src.includes('export async function getCryptoMeta'));

// 6. Tables defined
// 6. Tables defined — match key followed by colon, with or without trailing space
const tablePatterns = ['auditLog', 'ingests', 'signers', 'macroHistory', 'agents', 'cryptoMeta', 'policy'];
for (const t of tablePatterns) {
  check(`Table "${t}" in schema`, src.includes(`${t}:`) || src.includes(`${t} :`));
}

// 7. Indexes correct for v4
check('v4 auditLog has seq index', src.includes("'++id, seq, epochId, timestamp, type, [timestamp+type], stage, severity'"));
check('v4 auditLog has epochId index', src.includes('epochId'));

// 8. Version tracking helpers (getSchemaHealth)
check('getSchemaHealth exported', src.includes('export async function getSchemaHealth'));

// 9. Build still works (exec'd separately via npm run build)

console.log(`\n=== Summary: ${pass}/${pass + fail} passed ===`);
if (fail > 0) process.exit(1);
