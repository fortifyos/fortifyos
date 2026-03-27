/**
 * TASK-FOS-002 Stable Verifier
 * Locked after initial development run.
 * Changes to this file require a new task.
 * Hash: c336a7f7 baseline
 */
import { readFileSync } from 'fs';

const modules = {
  vaultSigning: '/Users/fortifyos/fortifyos/src/security/vaultSigning.js',
  passkeys: '/Users/fortifyos/fortifyos/src/security/passkeys.js',
  sovereignCrypto: '/Users/fortifyos/fortifyos/src/crypto/sovereignCrypto.js',
};

let pass = 0, fail = 0;

function check(name, cond, detail = '') {
  if (cond) { console.log(`PASS: ${name}`); pass++; }
  else { console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}

for (const [name, path] of Object.entries(modules)) {
  const src = readFileSync(path, 'utf8');
  console.log(`\n=== ${name} ===`);

  const errorClasses = [...src.matchAll(/export class (\w+Error\w*) extends Error/g)].map(m => m[1]);
  check(`  Typed error classes (${errorClasses.length})`, errorClasses.length >= 3, errorClasses.join(', '));

  const errorCodes = [...src.matchAll(/throw new \w+Error\([^,]+,\s*'([\w]+)'/g)].map(m => m[1]);
  check(`  Error codes (${errorCodes.length})`, errorCodes.length >= 4, [...new Set(errorCodes)].join(', '));

  const severities = [...new Set([...src.matchAll(/throw new \w+Error\([^,]+,\s*'[\w]+',\s*'([\w]+)'/g)].map(m => m[1]))];
  check(`  Severity levels (${severities.length})`, severities.length >= 2, severities.join(', '));

  check('  Imports secureLogRef', src.includes('import { secureLogRef }'));
  check('  No silent .catch(() => false)', !src.includes('.catch(() => false)'));

  const auditCalls = src.match(/audit\w+Event\(/g) || [];
  check(`  Audit events fired (${auditCalls.length})`, auditCalls.length >= 5);

  const typedThrows = src.match(/throw new \w+Error\(/g) || [];
  check(`  Typed throws (${typedThrows.length})`, typedThrows.length >= 4);

  const rawThrows = src.match(/throw new Error\(/g) || [];
  check('  No bare throw new Error()', rawThrows.length === 0, rawThrows.length > 0 ? `found ${rawThrows.length}` : '');
}

console.log(`\n=== Summary: ${pass}/${pass + fail} checks passed ===`);
if (fail > 0) process.exit(1);
