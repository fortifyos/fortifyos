# 🛡️ FORTIFY: WEALTH ARCHITECTURE HUD
## knox/assets/hud-template.md | Version 2.0
## Triggered by: /sync | /monthly | "give me the HUD" | Sunday 19:00

Knox populates all {{placeholders}} by running the Python brain below against
live CSV data before rendering any output. Never hardcode these values.

---

## THE PYTHON BRAIN (Run First — Always)

```python
import pandas as pd
from datetime import datetime, date

def generate_hud_data():
    # Load data files
    debts    = pd.read_csv('references/debt-avalanche.csv')
    bills    = pd.read_csv('references/bills-registry.csv')
    payments = pd.read_csv('references/payment-log.csv')
    bnpl     = pd.read_csv('references/bnpl-tracker.csv')

    # ── DEBT & STAGE ──────────────────────────────────────────
    total_debt     = debts['BALANCE'].sum()
    original_debt  = debts['BALANCE'].sum()  # update to original_total when known
    daily_leak     = sum((r['BALANCE'] * (r['APR']/100)) / 365
                        for _, r in debts.iterrows())

    # Dynamic stage from wealth-roadmap.md logic
    monthly_exp    = bills['AMOUNT'].sum()
    efund          = 0  # pull from confirmed e-fund balance (USAA + CashApp)
    if total_debt > 0 and efund < monthly_exp:         stage = 0
    elif total_debt > 0 and efund >= monthly_exp:      stage = 1
    elif total_debt > 0 and efund >= monthly_exp * 6:  stage = 2
    elif total_debt == 0:                              stage = 3

    stage_names = {
        0: "Financial Chaos",
        1: "Financial Stability",
        2: "Financial Safety",
        3: "Debt Liberation ✅"
    }

    # ── VELOCITY ──────────────────────────────────────────────
    total_income    = payments[payments['METHOD'] == 'income']['AMOUNT'].sum()
    debt_principal  = payments[payments['NOTES'].str.contains('principal', na=False)]['AMOUNT'].sum()
    savings         = payments[payments['SOURCE_ACCOUNT'] == 'CashApp']['AMOUNT'].sum()
    velocity        = round((debt_principal + savings) / total_income, 2) if total_income > 0 else 0

    # ── BUDGET RATIOS ─────────────────────────────────────────
    essential  = bills[bills['CATEGORY'].isin(['Essential','Debt','Medical'])]['AMOUNT'].sum()
    lifestyle  = bills[bills['CATEGORY'] == 'Discretionary']['AMOUNT'].sum()
    wealth_d   = bills[bills['CATEGORY'] == 'Savings']['AMOUNT'].sum()
    e_pct      = round((essential / total_income) * 100) if total_income > 0 else 0
    l_pct      = round((lifestyle / total_income) * 100) if total_income > 0 else 0
    w_pct      = round((wealth_d  / total_income) * 100) if total_income > 0 else 0

    # ── PROGRESS BAR ──────────────────────────────────────────
    # Requires original_debt to be set manually first time
    debt_eliminated = max(0, original_debt - total_debt)
    pct_done        = round((debt_eliminated / original_debt) * 100) if original_debt > 0 else 0
    filled          = int(pct_done / 5)   # 20-char bar, each block = 5%
    bar             = "█" * filled + "░" * (20 - filled)

    v_filled        = int(min(velocity / 0.25, 1.0) * 10)
    v_bar           = "█" * v_filled + "░" * (10 - v_filled)

    # ── LIBERATION DATE ───────────────────────────────────────
    liberation      = date(2026, 10, 1)
    days_remaining  = (liberation - date.today()).days

    # ── NEVER LIST CHECK ──────────────────────────────────────
    bnpl_active     = len(bnpl[bnpl['STATUS'] == 'ACTIVE'])
    top_target      = debts.sort_values('APR', ascending=False).iloc[0]['NAME'] if len(debts) > 0 else "N/A"
    top_apr         = debts.sort_values('APR', ascending=False).iloc[0]['APR'] if len(debts) > 0 else 0

    return {
        'report_date':      datetime.now().strftime("%B %d, %Y"),
        'stage':            stage,
        'stage_name':       stage_names[stage],
        'total_debt':       total_debt,
        'daily_leak':       daily_leak,
        'days_remaining':   days_remaining,
        'velocity':         velocity,
        'v_bar':            v_bar,
        'bar':              bar,
        'pct_done':         pct_done,
        'e_pct':            e_pct,
        'l_pct':            l_pct,
        'w_pct':            w_pct,
        'top_target':       top_target,
        'top_apr':          top_apr,
        'bnpl_active':      bnpl_active,
        'defense_mode':     "ACTIVE" if total_debt > 0 else "CLEAR",
        # ── BTC CYCLE GATE (SK14) ─────────────────────────────
        'btc_halving_date':  'YYYY-MM-DD',
        'btc_days_since':    0,
        'btc_state':         'UNKNOWN',
        'btc_permission':    'LOCKED',
        'btc_dca_cap_week':  0
    }

d = generate_hud_data()
```

---

## HUD OUTPUT TEMPLATE

After running the brain above, render this with populated values:

```
🛡️ FORTIFY: WEALTH ARCHITECTURE HUD
Reporting Period: {d['report_date']} | Defense Mode: {d['defense_mode']}
═══════════════════════════════════════════════════════════════

STAGE {d['stage']}/3 — {d['stage_name']}
Debt Liberation:
  {d['bar']}  {d['pct_done']}% complete
  Eliminated: $X,XXX of $XX,XXX total | Remaining: ${d['total_debt']:,.2f}
  Daily Interest Leak: ${d['daily_leak']:.2f}/day  ← money burning right now
  Target: October 2026 ({d['days_remaining']} days)

VELOCITY (V): {d['velocity']:.2f}  [{d['v_bar']}]  target: ≥ 0.25
  {('✅ ON PACE' if d['velocity'] >= 0.25 else '🟡 WATCH' if d['velocity'] >= 0.20 else '🔴 SLASH REQUIRED')}

═══════════════════════════════════════════════════════════════
CORE RATIOS (50/30/20)
  Essential:  {d['e_pct']}%  {'✅' if d['e_pct'] <= 50 else '🔴 OVER'}   (target ≤50%)
  Lifestyle:  {d['l_pct']}%  {'✅' if d['l_pct'] <= 30 else '🔴 SLASH'}  (target ≤30%)
  Wealth:     {d['w_pct']}%  {'✅' if d['w_pct'] >= 20 else '🔴 UNDER'}  (target ≥20%)

═══════════════════════════════════════════════════════════════
AVALANCHE STATUS (sk13)
  Alpha Target:  {d['top_target']} @ {d['top_apr']}% APR
  BNPL Plans:    {d['bnpl_active']} active (sk02 countdown running)
  Protocol Check:
    ☐ No Never List violations detected
    ☐ sk03 pre-sanity check cleared
    ☐ All extra payments → Alpha Target

═══════════════════════════════════════════════════════════════
MACRO INTEL
  Net Liquidity: $X.XXt  (7-day: EXPANDING / CONTRACTING / NEUTRAL)
  BTC CYCLE GATE (SK14)
    Halving:        {d['btc_halving_date']}
    Days since:     {d['btc_days_since']}
    State:          {d['btc_state']}
    Permission:     {d['btc_permission']}
    DCA cap:        ${d['btc_dca_cap_week']}/week
  FedWatch:      XX% cut probability (Δ: +/-X%)

SLOAN MARKET PULSE (TCG)
  [Set trend / pop report shift / sealed product movement]
  [S&S Alt Arts vs modern subset rotation status]

═══════════════════════════════════════════════════════════════
CFO INSIGHT:
  [1-2 sentence direct analysis — biggest win, biggest risk, top action]

TOP 3 ACTIONS THIS WEEK:
  1. [Specific | Measurable | Highest impact]
  2. [Specific | Measurable | Second priority]
  3. [Specific | Measurable | Third priority]

/panic if emergency | Stage 3 gate: total_debt = $0 unlocks investment logic
═══════════════════════════════════════════════════════════════
```

---

## Morning Pulse (Daily — abbreviated HUD)

Trigger: "Good morning" / `/cfo`

```
🛡️ CFO SNAPSHOT — [Date] [Time] EST
═══════════════════════════════════════════════════════════════
STAGE {d['stage']} | Defense Mode: {d['defense_mode']}
  {d['bar']}  {d['pct_done']}% | ${d['daily_leak']:.2f} leaking today in interest

VELOCITY: {d['velocity']:.2f}  [{d['v_bar']}]  target 0.25

BUDGET:
  Bills <48hrs:  [List or "None"]
  USAA now:      $XXX.XX
  Cash App:      $XXX.XX

MACRO:
  Net Liquidity: $X.XXt (EXPANDING / CONTRACTING)
  BTC CYCLE GATE (SK14)
    Halving:        {d['btc_halving_date']}
    Days since:     {d['btc_days_since']}
    State:          {d['btc_state']}
    Permission:     {d['btc_permission']}
    DCA cap:        ${d['btc_dca_cap_week']}/week

LIBERATION:    {d['days_remaining']} days to October 2026
═══════════════════════════════════════════════════════════════
/panic | /bills | /cashflow | /avalanche | /liberation
```

---

## Weekly HUD (Sunday 19:00 EST — /sync)

Full HUD template above + weekly delta:

```
WEEK OVER WEEK:
  Debt reduced:   -$XXX  (was $X,XXX → now $X,XXX)
  E-Fund change:  +$XXX  (XX days of runway)
  Velocity Δ:     +/-X.XX vs last week
  Interest saved: $XX vs minimum-payment-only scenario
```

---

## Budget Slash Report (Auto-triggered when V < 0.20)

```
🔴 BUDGET SLASH REPORT — [Date]
  Velocity (V):  {d['velocity']:.2f} — BELOW 0.20 THRESHOLD
  
  SLASH TARGETS (Lifestyle category first):
  [Item]    $XX/month  →  CANCEL
  [Item]    $XX/month  →  REDUCE to $XX

  V after cuts:     X.XX (projected)
  Monthly recovered: $XXX → redirected to {d['top_target']}
```
