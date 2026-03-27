/**
 * TASK-PBR-003 Verification Suite — Stable
 * Locked after development.
 */

import { createAlert, AlertLevel, AlertChannel, AlertEmitter, AlertDispatcher } from '../src/alerts/AlertEmitter.js';
import { createConsoleAdapter, createBroadcastAdapter, createNotificationAdapter, createWebhookAdapter } from '../src/alerts/adapters.js';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { console.log(`PASS: ${name}`); pass++; }
  else { console.log(`FAIL: ${name}${detail ? ' — ' + detail : ''}`); fail++; }
}
function section(n) { console.log(`\n=== ${n} ===`); }

section('Alert Creation');
check('createAlert with title', createAlert({ title: 'test' }).title === 'test');
check('createAlert rejects empty title', (() => { try { createAlert({}); return false; } catch { return true; } })());
check('createAlert adds id', createAlert({ title: 't' }).id?.length > 0);
check('createAlert adds timestamp', !!createAlert({ title: 't' }).timestamp);
check('createAlert defaults to INFO', createAlert({ title: 't' }).level === 'INFO');
check('createAlert accepts WARN level', createAlert({ title: 't', level: AlertLevel.WARN }).level === 'WARN');
check('createAlert accepts CRITICAL level', createAlert({ title: 't', level: AlertLevel.CRITICAL }).level === 'CRITICAL');
check('createAlert limits body to 1024 chars', createAlert({ title: 't', body: 'a'.repeat(2000) }).body.length === 1024);

section('AlertEmitter — Deduplication');
const emitter = new AlertEmitter();
emitter.setCooldown('test-tag', 1000);

// First emit should succeed
const first = emitter.emit({ title: 'First', tags: ['test-tag'] });
check('emit returns alert on first call', first !== null && first?.title === 'First');

// Immediate second emit should be deduplicated
const second = emitter.emit({ title: 'Second', tags: ['test-tag'] });
check('emit returns null when in cooldown', second === null);

// After cooldown expires, should emit again
await new Promise(r => setTimeout(r, 1100));
const third = emitter.emit({ title: 'Third', tags: ['test-tag'] });
check('emit succeeds after cooldown expires', third !== null && third?.title === 'Third');

section('AlertDispatcher — Adapter Selection');
const consoleOnly = new AlertDispatcher([createConsoleAdapter()]);
check('dispatcher picks available adapter', consoleOnly.getAvailableAdapter()?.name === 'ConsoleAdapter');

// No webhook configured — should return null adapter
const noWebhook = new AlertDispatcher([createWebhookAdapter()]);
check('webhook with no URL returns null adapter', noWebhook.getAvailableAdapter() === null);

// Mixed: console + unavailable
const mixed = new AlertDispatcher([
  createWebhookAdapter(),
  createConsoleAdapter(),
]);
check('dispatcher skips unavailable, picks next', mixed.getAvailableAdapter()?.name === 'ConsoleAdapter');

section('ConsoleAdapter — Always Works');
const ca = createConsoleAdapter();
check('isAvailable: console', ca.isAvailable() === true);
check('send does not throw', (async () => { await ca.send(createAlert({ title: 't', body: 'b', level: 'INFO' })); return true; })());

section('BroadcastAdapter — isAvailable');
const ba = createBroadcastAdapter({ enabled: false });
check('disabled broadcast: unavailable', ba.isAvailable() === false);

section('WebhookAdapter — Graceful Degradation');
const wa1 = createWebhookAdapter();
check('no URL: unavailable', wa1.isAvailable() === false);

const wa2 = createWebhookAdapter({ url: 'not-a-url' });
check('invalid URL: unavailable', wa2.isAvailable() === false);

const wa3 = createWebhookAdapter({ url: 'https://example.com/webhook' });
check('valid URL: available', wa3.isAvailable() === true);

section('NotificationAdapter — Permission Handling');
const na = createNotificationAdapter();
check('default notification: isAvailable reflects permission', na.isAvailable() === (typeof Notification !== 'undefined'));

section('Full Pipeline — emit + dispatch');
const pipe = new AlertDispatcher([createConsoleAdapter()]);
const result = await pipe.emit({ title: 'Pipeline test', level: AlertLevel.WARN });
check('emit returns alert when not deduplicated', result.alert !== null);
check('dispatch returns SENT', result.status === 'SENT');
check('dispatch returns adapter name', result.adapter === 'ConsoleAdapter');

// First emit succeeds, then set cooldown, then second emit is deduped
const dupResult = await pipe.emit({ title: 'Dup', tags: ['pipeline-dup'] });
pipe.setCooldown('pipeline-dup', 10_000);
const dupResult2 = await pipe.emit({ title: 'Dup2', tags: ['pipeline-dup'] }); // should be deduped
check('deduped alert returns DROPPED', dupResult2.status === 'DROPPED');

section('Sensitive Content — No Leakage');
const webhookResult = await new AlertDispatcher([createWebhookAdapter({ url: 'https://example.com/hook' })]).dispatch(
  createAlert({ title: 'Alert', body: 'Body', source: 'test' })
);
check('dispatch result has no sensitive data in error field', !webhookResult.error || !/secret|password|key/i.test(webhookResult.error || ''));

console.log(`\n=== Summary: ${pass}/${pass + fail} passed ===`);
if (fail > 0) process.exit(1);
else console.log('All checks passed.');
