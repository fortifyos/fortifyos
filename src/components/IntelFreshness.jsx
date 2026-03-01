import { useEffect, useMemo, useState } from "react";

function pad2(n) { return String(n).padStart(2, "0"); }

function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

/**
 * If `intel.nextRunAt` missing, compute next 08:00 in `intel.radarTZ` (or default).
 * Uses Intl time zone parts (no extra deps). Best-effort.
 */
function computeNextRunAt(radarTZ = "America/New_York") {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: radarTZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now).reduce((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  const y = Number(parts.year);
  const m = Number(parts.month);
  const d = Number(parts.day);
  const hh = Number(parts.hour);

  // target local time: 08:00:00 in radarTZ
  // Build a "local" date object in UTC, then adjust using the TZ offset at that instant.
  const targetDay = (hh >= 8) ? d + 1 : d;

  // Use Date.UTC to safely handle month overflow (e.g., Feb 28 + 1 → Mar 1)
  const safeDate = new Date(Date.UTC(y, m - 1, targetDay));
  const sy = safeDate.getUTCFullYear();
  const sm = safeDate.getUTCMonth() + 1;
  const sd = safeDate.getUTCDate();

  // Create a naive ISO string for 08:00 in radarTZ date.
  const isoLocal = `${sy}-${pad2(sm)}-${pad2(sd)}T08:00:00`;

  // Convert to actual Date by interpreting isoLocal as if it's in radarTZ:
  // We get the timezone offset by comparing format in radarTZ to UTC.
  const asUTC = new Date(isoLocal + "Z"); // placeholder
  // Find the offset minutes at that instant
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone: radarTZ,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(asUTC);

  const off = tzParts.find(p => p.type === "timeZoneName")?.value || "UTC";
  // off like "GMT-05:00"
  const m2 = off.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  let offsetMin = 0;
  if (m2) {
    const sign = m2[1] === "-" ? -1 : 1;
    const oh = Number(m2[2]);
    const om = Number(m2[3] || "0");
    offsetMin = sign * (oh * 60 + om);
  }
  // The local time in radarTZ corresponds to UTC time = local - offset
  const targetUTC = new Date(Date.parse(isoLocal + "Z") - offsetMin * 60 * 1000);
  return targetUTC;
}

/** Minimal inline SVG sparkline with draw animation */
function Sparkline({ series = [], width = 160, height = 38 }) {
  if (!series?.length) return null;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * (width - 2) + 1;
    const y = (1 - (v - min) / span) * (height - 2) + 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Volatility sparkline"
      className="spark"
    >
      <rect x="0" y="0" width={width} height={height} rx="6" className="spark-bg" />
      <polyline points={pts} className="spark-line" fill="none" />
    </svg>
  );
}

export default function IntelFreshness() {
  const [intel, setIntel] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetch("/macro-sentinel/latest.json", { cache: "no-store" })
      .then(res => res.json())
      .then(data => setIntel(data))
      .catch(() => setIntel(null));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!intel) {
    return null;
  }

  const generated = new Date(intel.generatedAt);
  const diffHours = (now - generated) / (1000 * 60 * 60);

  let freshness = "Fresh";
  if (intel.isHoliday) freshness = "Holiday";
  else if (diffHours > 6) freshness = "Stale";

  const radarTZ = intel.radarTZ || "America/New_York";
  const nextRunAt = intel.nextRunAt ? new Date(intel.nextRunAt) : computeNextRunAt(radarTZ);
  const countdownMs = nextRunAt ? (nextRunAt - now) : 0;

  const regime = intel.regimeMode || "UNKNOWN";
  const regimeLabel = regime === "RISK_ON" ? "Risk-On" : regime === "RISK_OFF" ? "Risk-Off" : "Unknown";

  const vol = intel.volatility || {};
  const volSeries = Array.isArray(vol.series) ? vol.series : [];
  const volPct = (typeof intel.volatilityPercentile === "number") ? intel.volatilityPercentile : null;

  const htmlFile = intel.htmlFile || null;
  const htmlHref = htmlFile ? `/radar/${htmlFile}` : null;

  const hashShort = intel.htmlSha256 ? intel.htmlSha256.slice(0, 10) : null;

  return (
    <div className={`intel-block intel-anim ${freshness.toLowerCase()}`}>
      <div className="intel-top">
        <div className="intel-title">
          <span>Macro Sentinel</span>
          <span className={`status s-${freshness.toLowerCase()}`}>{freshness}</span>
          {hashShort ? <span className="hash">#{hashShort}</span> : null}
        </div>

        <div className="intel-right">
          <div className={`regime r-${regime.toLowerCase()}`}>
            {regimeLabel}
          </div>
          <div className="countdown">
            Next run ({radarTZ}): <b className="countdown-pulse">{nextRunAt ? formatCountdown(countdownMs) : "—"}</b>
          </div>
        </div>
      </div>

      <div className="intel-mid">
        <div className="intel-meta">
          <div>Generated: {generated.toLocaleString()}</div>
          <div>Stance: {intel.overallStance}</div>
          <div>Most Bullish: {intel.mostBullish}</div>
          <div>Highest Risk: {intel.highestRisk}</div>
          <div>
            Volatility: {volPct !== null ? <b>{volPct}th pct</b> : <span className="proxy">n/a</span>}
            {vol.isProxy ? <span className="proxy"> (Proxy)</span> : null}
          </div>
        </div>

        <div className="intel-spark">
          <div className="spark-label">
            {vol.label || "Volatility"} {vol.isProxy ? <span className="proxy">(Proxy)</span> : null}
          </div>
          <Sparkline series={volSeries} />
        </div>
      </div>

      <div className="intel-actions">
        {htmlHref ? (
          <a href={htmlHref} target="_blank" rel="noopener noreferrer" className="intel-link">
            View Full Radar →
          </a>
        ) : (
          <span className="proxy">No HTML report published</span>
        )}
        <a href="/radar/index.html" className="intel-link secondary">
          Archive →
        </a>
      </div>
    </div>
  );
}
