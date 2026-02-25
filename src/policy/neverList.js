export const NEVER_LIST = [
  {
    name: 'BLOCK_EXTERNAL_TRANSFERS',
    check: (proposal) => proposal?.action === 'EXTERNAL_TRANSFER'
  },
  {
    name: 'BLOCK_SEED_PHRASES',
    check: (proposal) => String(proposal?.payload || '').toLowerCase().includes('seed phrase')
  }
];
