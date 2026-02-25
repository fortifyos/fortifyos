# Parse Protocols — Statement & Screenshot Extraction
## Trigger: Any financial document, image, or screenshot submitted by user

---

## Security Protocol — Bash Sanitization (Runs Before Any Shell Command)

KNOX uses Bash(python *) for file parsing. Before passing any filename or user-supplied
input to a shell command, sanitize it. Failure creates command injection risk.

Rules that apply to every bash execution in this skill:

  1. WHITELIST ONLY — Accept only alphanumeric chars, hyphens, underscores, and dots.
     Pattern: `re.match(r'^[\w\-\.]+$', filename)` — reject everything else.

  2. NEVER INTERPOLATE RAW INPUT — Use subprocess with argument lists, not shell=True.
     ✗ WRONG:  os.system(f"cat {filename}")
     ✅ RIGHT: subprocess.run(["cat", filename], capture_output=True)

  3. PATH TRAVERSAL BLOCK — Reject any input containing `..`, `/`, or `~`.

  4. ABSOLUTE PATH LOCK — All file operations anchored to FORTIFY data directory.
     No relative path execution.

  5. LOG REJECTIONS — Any sanitization failure logged with reason before abort.
     Never silently fail.

---

## Core Directive

When the user submits any financial document — screenshot, PDF, photo, exported statement —
redact sensitive fields first, then parse. Do not ask for manual re-entry. Extract all
available data, categorize it, surface patterns, and present structured CFO findings.

Every dollar on the document gets accounted for. No line item skipped.

---

## STEP 0 — REDACT BEFORE DISPLAYING ANYTHING

This runs before extraction. Before any data is shown in chat, scrub the following:

| Sensitive Field        | Rule                                      | Display As          |
|------------------------|-------------------------------------------|---------------------|
| Social Security Number | Never display any digits                  | [SSN REDACTED]      |
| Account numbers        | Keep last 4 digits only                   | ••••••••1234        |
| Routing numbers        | Never display                             | [ROUTING REDACTED]  |
| Full name              | First name only (if needed for context)   | [First name] only   |
| Home address           | Never display                             | [ADDRESS REDACTED]  |
| Date of birth          | Never display                             | [DOB REDACTED]      |
| Phone number           | Never display                             | [PHONE REDACTED]    |
| Email address          | Never display                             | [EMAIL REDACTED]    |
| Card number            | Keep last 4 digits only                   | ••••••••••••1234    |
| Username / login       | Never display                             | [CREDENTIAL REDACTED]|

Hard rules:
  - Redaction happens before any output is generated — nothing sensitive ever appears in chat
  - Original file is untouched on your device — KNOX only sees what you submitted
  - Last 4 digits of account/card numbers are preserved for identification purposes
  - If a field is ambiguous (looks like it could be sensitive), redact it
  - No exceptions. No "partial" displays of SSNs or full account numbers under any condition

After redaction, proceed to Step 1 — Extract.

---

## Document Type Recognition

Identify document type on receipt, then apply the matching extraction protocol:

| Document Type          | Key Data to Extract                                              |
|------------------------|------------------------------------------------------------------|
| Bank statement         | Opening/closing balance, all transactions, fees, interest earned |
| Credit card statement  | Balance, minimum due, APR, all charges, interest charged         |
| Pay stub               | Gross pay, net pay, all deductions, YTD figures                  |
| Investment account     | Balance, positions, contributions, gains/losses                  |
| Utility / bill         | Amount due, due date, rate, usage trend vs prior period          |
| Receipt                | Merchant, amount, date, category                                 |
| Loan statement         | Principal balance, interest rate, payment breakdown, payoff date |
| Screenshot (app/web)   | Parse whatever is visible — balance, transaction list, chart     |

---

## Extraction Protocol (Step 1)

Pull every data point visible in the document. Structure as a clean table.

Bank / Credit Card:
```
DATE       | MERCHANT / DESCRIPTION       | AMOUNT   | RUNNING BALANCE
-----------|------------------------------|----------|----------------
MM/DD      | [Name]                       | -$XX.XX  | $X,XXX.XX
MM/DD      | [Name]                       | +$XX.XX  | $X,XXX.XX
```

Pay Stub:
```
GROSS PAY:          $X,XXX.XX
  Federal Tax:     -$XXX.XX
  State Tax:       -$XXX.XX
  FICA/SS:         -$XXX.XX
  Medicare:        -$XXX.XX
  [Other deductions]
NET PAY:             $X,XXX.XX
YTD Gross:          $XX,XXX.XX
YTD Net:            $XX,XXX.XX
Effective Tax Rate: XX%
```

Loan Statement:
```
CURRENT BALANCE:    $X,XXX.XX
INTEREST RATE:      XX.XX% APR
LAST PAYMENT:       $XXX.XX (principal: $XX | interest: $XX)
INTEREST THIS STMT: $XX.XX
MINIMUM DUE:        $XXX.XX
PAYOFF ESTIMATE:    [Calculate at current pace]
```

---

## Categorization Protocol (Step 2)

Map every extracted transaction to a FORTIFY budget category:

| Category       | Examples                                               |
|----------------|--------------------------------------------------------|
| Essential       | Rent/mortgage, groceries, utilities, insurance, gas   |
| Medical         | Medical expenses, prescriptions, appointments, therapy      |
| Debt Service    | Minimum payments, extra principal payments            |
| Savings         | Emergency fund contributions                          |
| Discretionary   | Dining out, entertainment, subscriptions, shopping    |
| Income          | Paycheck deposits, transfers in                       |
| Unknown / Flag  | Anything unrecognized — request clarification         |

Flag rules:
  🔴 Unknown merchant > $25 → flag immediately, request clarification
  🔴 Duplicate charge (same merchant, same amount, within 7 days) → flag
  🟡 Subscription charge not previously noted → flag as "confirm intentional"
  🟡 Fee charged by bank or lender → flag as negotiation or cancellation candidate

---

## Pattern Analysis Protocol (Step 3)

After extraction and categorization, run these pattern checks:

### Spending Patterns
- Category totals vs prior period (if multiple statements submitted — show trend)
- Discretionary as % of net income (target: decreasing over time)
- Largest single discretionary spend — is it intentional?
- Day-of-week or time-of-month clustering (when does most discretionary spending happen?)

### Debt Patterns
- Interest paid vs principal paid ratio (how much of payment is pure waste?)
- Daily interest cost: (Balance × APR) / 365 = $X/day
- Payoff acceleration math: "Adding $X/mo saves $XXX in interest and pays off X months sooner"
- Balance transfer opportunity: Is APR high enough to warrant a 0% transfer?

### Income Patterns (from pay stubs)
- Effective tax rate — is withholding optimized?
- YTD pace vs annual target
- Deductions audit — any unknown or unnecessary deductions?

### Recurring Charge Audit
- List every recurring charge found (subscriptions, memberships, auto-pays)
- Flag any not recognized or not actively used
- Calculate annual cost of each: "This $14.99/mo = $179.88/yr"

### Anomaly Detection
- Any charge significantly larger than typical for that merchant
- Any charge at unusual hours (potential fraud indicator)
- Any fee that shouldn't exist (late fee, overdraft fee — negotiate or prevent)
- Any vendor with multiple charges in same period

---

## Presentation Protocol (Step 4)

Always present findings in this order:
  1. What was in the document (extraction summary)
  2. Where the money went (category breakdown with %)
  3. What stands out (patterns, anomalies, flags — highest impact first)
  4. What to do about it (prioritized action items with dollar impact)

CFO tone: Direct. No sugarcoating. If $200/mo is going to subscriptions, say it clearly
and calculate the annual waste. If debt interest is eating $8/day, make it visceral.
Celebrate positives (balance down, savings rate up) with equal clarity.

---

## Multi-Statement Analysis

When user submits multiple statements (same account, different months):
  - Build trend table across all periods
  - Calculate month-over-month deltas for each category
  - Identify improving vs worsening trends
  - Project forward: "At this pace, [debt/savings goal] reached by [date]"

When user submits multiple account types (checking + credit + loan):
  - Build unified cash flow picture across all accounts
  - Net cash position: all inflows minus all outflows
  - Debt service ratio: total debt payments / net income (target: <20%)
  - Full net worth snapshot: assets - liabilities

---

## Privacy Note

All parsed data stays in conversation context only.
Never reference, store, or summarize sensitive document data outside of active session.
Tax documents and detailed financial statements = local only per Privacy Wall protocol.
