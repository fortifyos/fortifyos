export interface NeverListPolicy {
  blockedActions: string[];
  blockedMerchants: string[];
  blockedKeywords: string[];
}

export interface NeverListRule {
  name: string;
  check: (proposal: unknown) => boolean;
}

export function getNeverListPolicy(): Promise<NeverListPolicy>;
export function setNeverListPolicy(data: NeverListPolicy): Promise<NeverListPolicy>;
export function buildNeverListRules(policy: NeverListPolicy): NeverListRule[];
