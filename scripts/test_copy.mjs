// ============================================================
// test-statement-parse.mjs
// Standalone Node.js test for FortifyOS statement parsing logic
// ============================================================

// ─────────────────────────────────────────────────────────────
// MOCK STATEMENT TEXT
// ─────────────────────────────────────────────────────────────

const USAA_CHECKING_TEXT = `
USAA Federal Savings Bank
Checking Account Statement
Account Number: ****4821
Statement Period: January 1, 2026 - January 31, 2026

Beginning Balance:    $4,215.83
Ending Balance:       $3,987.44

TRANSACTIONS

01/03  USAA PAYROLL DEPOSIT                   $3,450.00
01/05  HEB GROCERY #0142                        $127.63
01/07  CITY OF AUSTIN UTILITIES - ELECTRIC       $94.18
01/08  AT&T PHONE BILL                           $85.00
01/10  RENT PAYMENT - HIGHLAND APTS           $1,650.00
01/12  WALMART SUPERCENTER #4892                 $63.47
01/15  SPECTRUM INTERNET SERVICES                $59.99
01/17  USAA PAYROLL DEPOSIT                   $3,450.00
01/18  SHELL GAS STATION #2211                   $52.30
01/20  WHOLE FOODS MARKET                        $89.15
01/22  NETFLIX MONTHLY SUBSCRIPTION              $17.99
01/25  AUSTIN WATER UTILITIES                    $38.50
01/28  CHIPOTLE MEXICAN GRILL                    $14.85
01/30  STARBUCKS #00193                           $9.45
01/31  COSTCO WHOLESALE #0487                   $214.72

Thank you for banking with USAA.
`;

const CAPITAL_ONE_TEXT = `
Capital One Venture Rewards Credit Card
Account Number: ****7703
Statement Period: January 1, 2026 - January 31, 2026

Credit Limit:             $12,000.00
Statement Balance:         $1,847.33
Minimum Payment Due:          $35.00
Payment Due Date:         February 25, 2026

Purchase APR: 24.99%

TRANSACTIONS

01/02  NETFLIX.COM MONTHLY                       $17.99
01/03  SPOTIFY PREMIUM                           $11.99
01/06  AUSTIN ENERGY - ELECTRIC                  $94.18
01/08  SPECTRUM INTERNET                         $59.99
01/09  AT&T MOBILITY                             $85.00
01/11  HEB GROCERY #0312                         $98.76
01/13  SHELL OIL 57441892300                     $48.60
01/15  CHIPOTLE ONLINE ORDER                     $22.50
01/16  WHOLE FOODS MARKET 10                     $74.30
01/18  EXXON MOBIL 7-ELEVEN                      $55.10
01/20  MCDONALDS F30441                          $12.75
01/21  WALMART GROCERY PICKUP                    $133.22
01/23  STARBUCKS STORE 12903                     $16.40
01/25  TARGET 00023814                           $87.45
01/27  RESTAURANT DEPOT LLC                      $44.00
01/29  HEB CENTRAL MARKET                        $62.19
01/31  COSTCO GAS STATION                        $61.91

New Balance: $1,847.33

CapitalOne.com | 1-800-227-4825
`;

// ─────────────────────────────────────────────────────────────
// PURE PARSING FUNCTIONS  (mirrored from App.jsx logic)
// ─────────────────────────────────────────────────────────────

/** Strip currency symbols and commas, return float or NaN */
function parseAmountLike(s) {
  if (!s) return NaN;
  const cleaned = String(s).replace(/[$,\s]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? NaN : val;
}

/** Detect broad account type from raw statement text */
function detectAccountType(rawText) {
  const t = rawText.toLowerCase();
  if (t.includes('credit card') || t.includes('credit limit') || t.includes('minimum payment') || t.includes('purchase apr')) {
    return 'credit_card';
  }
  if (t.includes('checking') || t.includes('savings')) {
    return 'checking';
  }
  if (t.includes('401k') || t.includes('brokerage') || t.includes('investment')) {
    return 'investment';
  }
  return 'other';
}

/** Detect which institution template to use */
function detectStatementTemplate(rawText, fileName = '') {
  const combined = (rawText + ' ' + fileName).toLowerCase();
  if (combined.includes('usaa')) return 'usaa';
  if (/capital one|capitalone/.test(combined)) return 'capital_one';
  return 'generic';
}

/** Extract ending / statement balance from raw text */
function extractEndingBalance(rawText) {
  const patterns = [
    /ending\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
    /new\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
    /statement\s+balance[:\s]+\$?([\d,]+\.\d{2})/i,
  ];
  for (const re of patterns) {
    const m = rawText.match(re);
    if (m) return parseAmountLike(m[1]);
  }
  return null;
}

/** Parse individual transaction lines using date + description + amount */
function parseTransactionLines(rawText) {
  const lineRe = /^(\d{1,2}\/\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})$/gm;
  const transactions = [];
  let match;
  while ((match = lineRe.exec(rawText)) !== null) {
    const [, date, description, amountRaw] = match;
    const amount = parseAmountLike(amountRaw);
    if (!isNaN(amount)) {
      transactions.push({ date, description: description.trim(), amount });
    }
  }
  return transactions;
}

/** Categorize a transaction description */
function categorize(desc) {
  const d = desc.toLowerCase();
  if (/rent|mortgage/.test(d))                              return 'Housing';
  if (/electric|gas bill|water|internet|phone|at&t|spectrum|utilities/.test(d)) return 'Utilities';
  if (/netflix|spotify|hulu|disney/.test(d))               return 'Subscriptions';
  if (/walmart|target|costco|heb|grocery|whole foods|central market/.test(d))  return 'Groceries';
  if (/shell|exxon|mobil|gas station/.test(d))             return 'Transportation';
  if (/restaurant|chipotle|starbucks|mcdonald|mcdonalds/.test(d)) return 'Dining';
  if (/medical|clinic|pharmacy/.test(d))                   return 'Medical';
  if (/payroll|deposit/.test(d))                           return 'Income';
  return 'Other';
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function fmt(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pad(str, len) {
  return String(str).padEnd(len, ' ');
}

function summarizeByCategory(transactions, excludeCategories = []) {
  const map = {};
  for (const tx of transactions) {
    if (excludeCategories.includes(tx.category)) continue;
    map[tx.category] = (map[tx.category] || 0) + tx.amount;
  }
  return map;
}

// ─────────────────────────────────────────────────────────────
// PROCESS ONE ACCOUNT
// ─────────────────────────────────────────────────────────────

function processAccount(label, rawText, fileName) {
  console.log(`\n${'='.repeat(54)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(54)}`);

  // Detection
  const template    = detectStatementTemplate(rawText, fileName);
  const accountType = detectAccountType(rawText);
  const endBal      = extractEndingBalance(rawText);

  console.log(`\n  Template detected : ${template}`);
  console.log(`  Account type      : ${accountType}`);
  console.log(`  Ending balance    : ${endBal !== null ? fmt(endBal) : 'NOT FOUND'}`);

  // Transactions
  const rawTxns = parseTransactionLines(rawText);
  const txns = rawTxns.map(tx => ({ ...tx, category: categorize(tx.description) }));

  console.log(`\n  --- Transactions (${txns.length} found) ---\n`);
  console.log(`  ${pad('DATE', 7)} ${pad('CATEGORY', 15)} ${pad('AMOUNT', 10)}  DESCRIPTION`);
  console.log(`  ${'-'.repeat(70)}`);

  for (const tx of txns) {
    console.log(`  ${pad(tx.date, 7)} ${pad(tx.category, 15)} ${pad(fmt(tx.amount), 10)}  ${tx.description}`);
  }

  // Stats
  const income = txns.filter(t => t.category === 'Income').reduce((s, t) => s + t.amount, 0);
  const expenses = summarizeByCategory(txns, ['Income']);

  console.log(`\n  --- Summary ---\n`);
  console.log(`  Transaction count : ${txns.length}`);
  console.log(`  Total income      : ${fmt(income)}`);
  console.log(`\n  Expenses by category:`);
  for (const [cat, total] of Object.entries(expenses).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pad(cat, 18)} ${fmt(total)}`);
  }

  return { template, accountType, endBal, txns, income, expenses };
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

console.log('\n' + '#'.repeat(54));
console.log('  FortifyOS Statement Parser – Integration Test');
console.log('#'.repeat(54));

const usaaResult = processAccount(
  'USAA CHECKING',
  USAA_CHECKING_TEXT,
  'usaa-checking-jan2026.pdf'
);

const capitalOneResult = processAccount(
  'CAPITAL ONE CREDIT CARD',
  CAPITAL_ONE_TEXT,
  'capitalone-venture-jan2026.pdf'
);

// ─────────────────────────────────────────────────────────────
// NET WORTH SNAPSHOT
// ─────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(54)}`);
console.log('  NET WORTH SNAPSHOT');
console.log(`${'='.repeat(54)}\n`);

const usaaBalance = usaaResult.endBal ?? 0;
// For credit cards, ending balance is a liability (negative)
const ccBalance   = capitalOneResult.endBal ?? 0;
const netWorth    = usaaBalance - ccBalance;

console.log(`  USAA Checking balance   : ${fmt(usaaBalance)}   (asset)`);
console.log(`  Capital One CC balance  : ${fmt(ccBalance)}   (liability)`);
console.log(`  ${'─'.repeat(44)}`);
console.log(`  Estimated Net Worth     : ${fmt(netWorth)}`);

// ─────────────────────────────────────────────────────────────
// COMBINED EXPENSE BREAKDOWN
// ─────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(54)}`);
console.log('  COMBINED EXPENSE BREAKDOWN (both accounts)');
console.log(`${'='.repeat(54)}\n`);

const allExpenses = {};
for (const result of [usaaResult, capitalOneResult]) {
  for (const [cat, total] of Object.entries(result.expenses)) {
    allExpenses[cat] = (allExpenses[cat] || 0) + total;
  }
}

const totalExpenses = Object.values(allExpenses).reduce((s, v) => s + v, 0);
for (const [cat, total] of Object.entries(allExpenses).sort((a, b) => b[1] - a[1])) {
  const pct = ((total / totalExpenses) * 100).toFixed(1);
  console.log(`  ${pad(cat, 18)} ${pad(fmt(total), 12)}  (${pct}%)`);
}
console.log(`  ${'─'.repeat(44)}`);
console.log(`  ${pad('TOTAL EXPENSES', 18)} ${fmt(totalExpenses)}`);
console.log(`  ${pad('TOTAL INCOME', 18)} ${fmt(usaaResult.income)}`);
console.log(`  ${pad('NET CASH FLOW', 18)} ${fmt(usaaResult.income - totalExpenses)}`);

console.log('\n' + '#'.repeat(54));
console.log('  Test complete.');
console.log('#'.repeat(54) + '\n');
