function KnoxTerminalMod({ latest, visible, t }) {
  // Reliable dark mode detection via red-channel hex parsing
  const voidHex = (t.void || '#ffffff').replace('#', '');
  const isDarkKnox = parseInt(voidHex.slice(0, 2), 16) < 20;

  const cats = buildProtectionFirstBudget(
    latest?.budget?.income || latest?._meta?.income || 0,
    latest?.budget?.categories || [],
    latest
  );
  const income = latest?.budget?.income || latest?._meta?.income || 0;
  const velocity = calcVelocity(latest || {});
  const stage = calcStage(latest || {});
  const debts = latest?.debts || [];
  const days = runwayDaysFromLatest(latest);
  const di = dailyInterest(debts);

  // ── Tier 1: Medical / Health Shield ────────────────────────────
  const medCat = cats.find(c => c.name === 'Medical');
  const medAllocated = (medCat?.budgeted || 0) > 0;
  const medCovered = medAllocated && (medCat?.actual || 0) <= (medCat?.budgeted || 0);
  const medStatus = medCovered
    ? `${fmt(medCat?.actual || 0)} / ${fmt(medCat?.budgeted || 0)} COVERED`
    : medAllocated
      ? `OVER — ${fmt(medCat?.actual || 0)} vs ${fmt(medCat?.budgeted || 0)}`
      : 'NOT ALLOCATED';

  // ── Tier 1: Essentials ─────────────────────────────────────────
  const essCat = cats.find(c => c.name === 'Essentials');
  const essCovered = (essCat?.budgeted || 0) > 0 && (essCat?.actual || 0) <= (essCat?.budgeted || 0);
  const essStatus = essCat
    ? `${fmt(essCat.actual || 0)} / ${fmt(essCat.budgeted || 0)}`
    : 'NOT FOUND';

  // ── Tier 2: Fortress Wall Phase 1 ─────────────────────────────
  const ef = latest?.emergencyFund || {};
  const efBal = ef.balance || 0;
  const efPhase1Target = 1000;
  const efPhase1Done = efBal >= efPhase1Target;
  const efStatus = efPhase1Done
    ? `SECURED — ${fmt(efBal)} ≥ ${fmt(efPhase1Target)}`
    : `${fmt(efBal)} / ${fmt(efPhase1Target)} (${Math.round((efBal / efPhase1Target) * 100)}%)`;

  // ── Tier 2: NL violations ─────────────────────────────────────
  const discCat = cats.find(c => c.name === 'Discretionary');
  const subPct = income > 0 && discCat ? ((discCat.actual || 0) / income) * 100 : 0;
  const redirectAmt = (!efPhase1Done && discCat) ? (discCat.actual || 0) : 0;
  const blownCats = cats.filter(c => c.budgeted > 0 && c.actual > c.budgeted && c.name !== 'Medical');

  // ── Tier 3: Debt / Liberation ──────────────────────────────────
  const hasConsumerDebt = debts.some(d => (d.balance || 0) > 0 && !(d.totalTerms > 0));
  const highApr = debts.filter(d => (d.apr || 0) >= 20 && (d.balance || 0) > 0 && !(d.totalTerms > 0));
  const totalMins = debts.reduce((s, d) => s + (d.minPayment || 0), 0);
  const debtService = cats.find(c => c.name === 'Debt Service');
  const minOnlyOnHighApr = highApr.length > 0 && debtService && totalMins > 0
    && debtService.actual > 0 && debtService.actual <= totalMins * 1.05;
  const hasPositions = (latest?.portfolio?.equities?.length || 0) > 0
    || (latest?.portfolio?.crypto?.length || 0) > 0;
  const isFinancialChaos = hasConsumerDebt && hasPositions && stage <= 2;
  const totalDebt = debts.reduce((s, d) => s + (d.balance || 0), 0);

  // ── Velocity ───────────────────────────────────────────────────
  const velPct = Math.round(velocity * 100);
  const velOk = velocity >= 0.20 || income === 0;
  const velCritical = velocity < 0.10 && income > 0;

  // ── Build scan lines ───────────────────────────────────────────
  const lines = [];

  lines.push({ sep: 'TIER 1 ◈ VITAL INTEGRITY' });
  lines.push({
    tag: !medAllocated ? 'DANGER' : !medCovered ? 'WARNING' : 'VERIFIED',
    label: 'Priority 01: Health Shield',
    status: medStatus,
    ok: medCovered && medAllocated,
    rec: !medAllocated
      ? 'Allocate Medical budget immediately — Priority 1 is non-negotiable'
      : !medCovered ? 'Medical over budget — freeze non-Medical spend until covered' : null,
  });
  lines.push({
    tag: !essCat ? 'WARNING' : !essCovered ? 'WARNING' : 'VERIFIED',
    label: 'Priority 02: Essential Coverage',
    status: essStatus,
    ok: essCovered,
    rec: !essCovered && essCat
      ? `Essentials over by ${fmt((essCat.actual || 0) - (essCat.budgeted || 0))} — review fixed costs`
      : null,
  });

  lines.push({ sep: 'TIER 2 ◈ STRUCTURAL INTEGRITY' });
  lines.push({
    tag: efPhase1Done ? 'VERIFIED' : efBal > 0 ? 'WARNING' : 'DANGER',
    label: 'Priority 03: Fortress Wall Phase 1',
    status: efStatus,
    ok: efPhase1Done,
    rec: !efPhase1Done ? 'Direct all surplus + Discretionary to E-Fund until $1,000 locked' : null,
  });
  if (subPct > 2 && income > 0) {
    lines.push({
      tag: 'WARNING',
      label: `NL-1: Discretionary at ${subPct.toFixed(1)}% of income`,
      status: `${fmt(discCat?.actual || 0)} — limit is 2%`,
      ok: false,
      rec: 'Reduce Discretionary to $0 until E-Fund Phase 1 is locked',
    });
    if (redirectAmt > 0) {
      lines.push({
        tag: 'ACTION',
        label: `Redirect ${fmt(redirectAmt)} Discretionary → Fortress Wall`,
        status: null,
        ok: true,
      });
    }
  }
  blownCats.forEach(c => {
    lines.push({
      tag: 'DANGER',
      label: `NL-4: ${c.name} over budget`,
      status: `${fmt(c.actual)} vs ${fmt(c.budgeted)} (+${Math.round((c.actual / c.budgeted - 1) * 100)}%)`,
      ok: false,
      rec: `Freeze ${c.name} spend — wait for next pay cycle reset`,
    });
  });
  if (di > 10) {
    lines.push({
      tag: di > 25 ? 'DANGER' : 'WARNING',
      label: 'Interest Burn Rate',
      status: `${fmt(di)}/day — ${fmt(Math.round(di * 30))}/mo bleeding`,
      ok: false,
      rec: 'Attack highest APR balance — avalanche mode required',
    });
  }
  if (days < 30) {
    lines.push({
      tag: days < 7 ? 'DANGER' : 'WARNING',
      label: 'E-Fund Runway',
      status: `${days} days remaining — CRITICAL`,
      ok: false,
      rec: 'Direct next paycheck entirely to E-Fund starter fund',
    });
  }

  lines.push({ sep: 'TIER 3 ◈ LIBERATION PROGRESS' });
  if (minOnlyOnHighApr) {
    lines.push({
      tag: 'DANGER',
      label: `NL-2: ${highApr[0].name} at ${highApr[0].apr}% APR`,
      status: 'Minimum-only — avalanche required',
      ok: false,
      rec: `Add all surplus above minimums to ${highApr[0].name}`,
    });
  }
  if (isFinancialChaos) {
    lines.push({
      tag: 'DANGER',
      label: 'NL-3: Active positions in Defense Mode',
      status: `Stage ${stage} — Stage 3 gate not cleared`,
      ok: false,
      rec: 'Liquidate non-essential positions → redirect to debt avalanche',
    });
  }
  if (!minOnlyOnHighApr && !isFinancialChaos) {
    lines.push({
      tag: totalDebt === 0 ? 'VERIFIED' : 'SCANNING',
      label: 'Priority 04: Debt Liberation',
      status: totalDebt === 0
        ? 'ALL DEBTS ELIMINATED'
        : `${fmt(totalDebt)} outstanding — avalanche active`,
      ok: totalDebt === 0,
    });
  }
  lines.push({
    tag: velCritical ? 'DANGER' : !velOk ? 'WARNING' : 'SCANNING',
    label: 'Financial Velocity',
    status: `${velPct}% — ${velCritical ? 'CRISIS' : !velOk ? 'LOW: target 25%' : 'ON TARGET'}`,
    ok: velOk,
    rec: velCritical
      ? 'Freeze all discretionary — execute Budget Slash Protocol'
      : !velOk && income > 0
        ? `Cut ${fmt(Math.round(income * 0.05))}/mo in variable expenses to reach target`
        : null,
  });

  const criticalCount = lines.filter(l => l.tag === 'DANGER').length;
  const warnCount = lines.filter(l => l.tag === 'WARNING').length;

  const tagColor = tag => {
    if (tag === 'DANGER')   return t.danger;
    if (tag === 'WARNING')  return t.warn;
    if (tag === 'VERIFIED') return t.accent;
    if (tag === 'ACTION')   return t.accent;
    return t.textSecondary;
  };
  const tagBg = tag => {
    if (tag === 'DANGER')   return `${t.danger}18`;
    if (tag === 'WARNING')  return `${t.warn}14`;
    if (tag === 'VERIFIED') return `${t.accent}10`;
    if (tag === 'ACTION')   return `${t.accent}08`;
    return 'transparent';
  };

  return (
    <Card title="Agent KNOX" visible={visible} delay={280} alert={criticalCount > 0} t={t}>
      <div style={{
        background: isDarkKnox ? 'rgba(2,10,4,0.97)' : 'rgba(240,247,240,0.97)',
        border: `1px solid ${t.accent}40`,
        boxShadow: `0 0 8px ${t.accent}20, inset 0 0 20px ${t.accent}05`,
        padding: '12px 14px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, borderBottom: `1px solid ${t.accent}30`, paddingBottom: 8 }}>
          <span style={{ color: t.accent, fontWeight: 700, letterSpacing: '0.08em', fontSize: 13 }}>
            {'>'} AGENT KNOX — KERNEL SCAN
          </span>
          <span style={{ color: t.accent, animation: 'pulse 1s step-end infinite', fontSize: 14, lineHeight: 1 }}>▋</span>
          <span style={{ marginLeft: 'auto', color: t.textGhost, fontSize: 11 }}>
            {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>

        {/* Tiered scan lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {lines.map((line, i) => {
            if (line.sep) {
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0 4px', opacity: 0.55 }}>
                  <div style={{ flex: 1, height: 1, background: t.borderMid }} />
                  <span style={{ color: t.textGhost, fontSize: 10, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
                    {line.sep}
                  </span>
                  <div style={{ flex: 1, height: 1, background: t.borderMid }} />
                </div>
              );
            }
            return (
              <div key={i} style={{ animation: `radarFadeUp 0.3s ease-out ${i * 0.04}s both` }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 8,
                  padding: '4px 6px',
                  background: tagBg(line.tag),
                  borderLeft: `2px solid ${tagColor(line.tag)}40`,
                }}>
                  <span style={{ color: tagColor(line.tag), fontWeight: 700, fontSize: 11, flexShrink: 0, letterSpacing: '0.04em' }}>
                    [{line.tag}]
                  </span>
                  <span style={{ color: line.ok ? t.textSecondary : tagColor(line.tag), flex: 1, lineHeight: 1.4 }}>
                    {line.label}
                  </span>
                  {line.status && (
                    <span style={{ color: line.ok ? t.textDim : tagColor(line.tag), fontSize: 11, opacity: 0.85, flexShrink: 0, textAlign: 'right', maxWidth: 160, lineHeight: 1.3 }}>
                      {line.status}
                    </span>
                  )}
                </div>
                {line.rec && (
                  <div style={{ display: 'flex', gap: 6, padding: '2px 6px 4px 20px' }}>
                    <span style={{ color: t.accent, fontSize: 10, flexShrink: 0, opacity: 0.7 }}>{'↳'} REC:</span>
                    <span style={{ color: t.accent, fontSize: 10, opacity: 0.75, lineHeight: 1.4 }}>{line.rec}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.accent}20`, fontSize: 11, color: t.textGhost, display: 'flex', justifyContent: 'space-between' }}>
          <span>KNOX v2.0 | {criticalCount > 0 ? `${criticalCount} CRITICAL` : warnCount > 0 ? `${warnCount} WARNING` : '0 ALERTS'} | Stage {stage} / 7</span>
          <span style={{ color: criticalCount > 0 ? t.danger : warnCount > 0 ? t.warn : t.accent }}>
            {criticalCount > 0 ? '⬤ CRITICAL' : warnCount > 0 ? '⬤ WARNING' : '⬤ NOMINAL'}
          </span>
        </div>
      </div>
    </Card>
  );
}
