import { db } from '../db/sovereignDB';

const DEFAULT_POLICY = {
  blockedActions: ['EXTERNAL_TRANSFER'],
  blockedMerchants: [],
  blockedKeywords: ['seed phrase', 'private key', 'bank account number']
};

export async function getNeverListPolicy() {
  const row = await db.policy.get('neverList');
  if (row?.data) return row.data;
  await db.policy.put({ id: 'neverList', data: DEFAULT_POLICY, updatedAt: Date.now() });
  return DEFAULT_POLICY;
}

export async function setNeverListPolicy(data) {
  await db.policy.put({ id: 'neverList', data, updatedAt: Date.now() });
  return data;
}

export function buildNeverListRules(policy) {
  const blockedActions = new Set((policy?.blockedActions || []).map(s => String(s).trim()).filter(Boolean));
  const blockedMerchants = (policy?.blockedMerchants || []).map(s => String(s).trim()).filter(Boolean);
  const blockedKeywords = (policy?.blockedKeywords || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);

  return [
    {
      name: 'BlockedActions',
      check: (p) => blockedActions.has(String(p?.action || '').trim())
    },
    {
      name: 'BlockedMerchants',
      check: (p) => {
        const m = String(p?.merchant || '').toLowerCase();
        return blockedMerchants.some(x => m.includes(String(x).toLowerCase()));
      }
    },
    {
      name: 'BlockedKeywords',
      check: (p) => {
        const text = `${p?.action || ''} ${p?.notes || ''} ${p?.merchant || ''}`.toLowerCase();
        return blockedKeywords.some(k => k && text.includes(k));
      }
    }
  ];
}
