import { db } from '../db/sovereignDB';
import { secureLogRef } from './secureLogRef';

export async function upsertAgent({ id, name }) {
  await db.agents.put({
    id,
    name,
    lastHeartbeat: Date.now(),
    status: 'ACTIVE',
    leaseExpiresAt: Date.now() + 60 * 60 * 1000
  });
}

export async function heartbeat(id) {
  const a = await db.agents.get(id);
  if (!a) return;
  await db.agents.update(id, { lastHeartbeat: Date.now(), status: 'ACTIVE' });
}

export function startHeartbeatReaper({ stage, timeoutMs = 60 * 60 * 1000, intervalMs = 60 * 1000, onReclaim }) {
  const tick = async () => {
    const now = Date.now();
    const all = await db.agents.toArray();

    for (const a of all) {
      const dead = now - (a.lastHeartbeat || 0) > timeoutMs;
      if (dead && a.status !== 'DEAD') {
        await db.agents.update(a.id, { status: 'DEAD' });

        await secureLogRef()(
          'AGENT_DEATH',
          `Agent ${a.name || a.id} heartbeat lost - reclaim initiated`,
          stage,
          'CRITICAL'
        );

        if (onReclaim) await onReclaim(a);
      }
    }
  };

  const handle = setInterval(tick, intervalMs);
  return () => clearInterval(handle);
}
