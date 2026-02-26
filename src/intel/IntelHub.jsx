import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid
} from "recharts";
import { ArrowLeft, Search, Sparkles, RefreshCw } from "lucide-react";

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function toLabelRegime(regime){
  if(regime === "RISK_ON") return "RISK-ON";
  if(regime === "RISK_OFF") return "RISK-OFF";
  return "UNKNOWN";
}

function safeArray(x){ return Array.isArray(x) ? x : []; }

function pickTicker(latest, symbol){
  const t = safeArray(latest?.tickers).find(x => (x.ticker || "").toUpperCase() === symbol.toUpperCase());
  return t || null;
}

function formatTime(ts){
  try { return new Date(ts).toLocaleString(); } catch { return String(ts||""); }
}

function summarizeTicker(t){
  if(!t) return null;
  return {
    ticker: t.ticker,
    name: t.name || "",
    quickTake: t.quick_take || t.quickTake || "",
    newsClass: t.news_class || t.newsClass || "",
    social: t.social || "",
    options: t.options_signal || t.optionsSignal || "",
    risk: t.risk_level || t.riskLevel || "",
    action: t.action || ""
  };
}

function buildAnswer(query, latest){
  const q = (query||"").trim();
  if(!q) return { title: "Try a query", lines: ["Examples:", "• what's the regime today?", "• show me PLTR", "• top bullish tickers", "• options signals", "• what's the macro driver"] };

  const s = q.toLowerCase();
  const tickers = safeArray(latest?.tickers);
  const symbols = tickers.map(t => (t.ticker||"").toUpperCase()).filter(Boolean);

  const matched = symbols.find(sym => s.includes(sym.toLowerCase()));
  if(matched){
    const t = summarizeTicker(pickTicker(latest, matched));
    const news = safeArray(pickTicker(latest, matched)?.news).slice(0,5);
    const lines = [
      `${t.ticker}${t.name ? " — "+t.name : ""}`,
      `Quick take: ${t.quickTake || "n/a"}`,
      `News: ${t.newsClass || "n/a"}`,
      `Social: ${t.social || "n/a"}`,
      `Options: ${t.options || "n/a"}`,
      `Risk: ${t.risk || "n/a"}`,
      `Action: ${t.action || "n/a"}`,
    ];
    if(news.length){
      lines.push("Top news:");
      news.forEach(n => {
        const title = n.title || n[0] || "";
        const url = n.url || n[1] || "";
        lines.push(`- ${title}${url ? " ("+url+")" : ""}`);
      });
    }
    return { title: "Ticker Intel", lines };
  }

  if(s.includes("regime")){
    return {
      title: "Regime Mode",
      lines: [
        `Regime: ${toLabelRegime(latest?.regimeMode)}`,
        `Stance: ${latest?.overallStance || "n/a"}`,
        `Macro driver: ${latest?.macroDriver || "n/a"}`,
        "Rule (current): SPY MA5<MA20 => RISK-OFF; high avg risk score overrides.",
      ]
    };
  }

  if(s.includes("next run") || s.includes("countdown") || s.includes("when") && s.includes("run")){
    return {
      title: "Next Run",
      lines: [
        `Next run at: ${latest?.nextRunAt ? formatTime(latest.nextRunAt) : "n/a"}`,
        `Time zone: ${latest?.radarTZ || "n/a"}`,
      ]
    };
  }

  if(s.includes("bullish")){
    const bullish = tickers.filter(t => String(t.news_class||t.newsClass||"").toLowerCase().includes("bullish"));
    const list = bullish.length ? bullish : tickers.slice(0,3);
    return {
      title: "Bullish Focus",
      lines: [
        `Most bullish: ${latest?.mostBullish || (list[0]?.ticker || "n/a")}`,
        ...list.slice(0,8).map(t => `- ${t.ticker}: ${t.quick_take || t.quickTake || t.news_class || t.newsClass || ""}`.trim())
      ]
    };
  }

  if(s.includes("risk") || s.includes("highest")){
    const sorted = [...tickers].sort((a,b)=>(b.risk_score||b.riskScore||0)-(a.risk_score||a.riskScore||0));
    return {
      title: "Risk",
      lines: [
        `Highest risk: ${latest?.highestRisk || sorted[0]?.ticker || "n/a"}`,
        ...sorted.slice(0,8).map(t => `- ${t.ticker}: ${t.risk_level || t.riskLevel || "n/a"} (${t.risk_score||t.riskScore||"?"})`)
      ]
    };
  }

  if(s.includes("options")){
    const sorted = [...tickers].sort((a,b)=>((b.options?.put||0)-(b.options?.call||0)) - ((a.options?.put||0)-(a.options?.call||0)));
    return {
      title: "Options Signals",
      lines: sorted.slice(0,10).map(t => `- ${t.ticker}: ${t.options_signal || t.optionsSignal || "n/a"}`)
    };
  }

  if(s.includes("news")){
    const issues = safeArray(latest?.keyIssues);
    const lines = [];
    if(issues.length){
      lines.push("Key issues:");
      issues.slice(0,8).forEach(i=>{
        lines.push(`• Bull: ${i.bull||i[0]||""}`);
        lines.push(`  Bear: ${i.bear||i[1]||""}`);
      });
    } else {
      lines.push("No key-issues feed available yet.");
    }
    return { title: "News / Issues", lines };
  }

  return {
    title: "Intel Answer",
    lines: [
      `Stance: ${latest?.overallStance || "n/a"}`,
      `Regime: ${toLabelRegime(latest?.regimeMode)}`,
      `Most bullish: ${latest?.mostBullish || "n/a"}`,
      `Highest risk: ${latest?.highestRisk || "n/a"}`,
      `Macro driver: ${latest?.macroDriver || "n/a"}`,
      "",
      "Tip: include a ticker symbol (e.g., PLTR) to pull a ticker card."
    ]
  };
}

export default function IntelHub({ onBack, isDark, onToggleTheme }) {
  const [latest, setLatest] = useState(null);
  const [archive, setArchive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today"); // today | tickers | archive
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState([
    { role: "assistant", text: "Ask me anything about today’s regime, tickers, options, or news.\nExample: “what’s the regime today?”" }
  ]);

  const chatRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bust = Date.now();
      const base = import.meta.env.BASE_URL || "/";
      const [r1, r2] = await Promise.all([
        fetch(`${base}macro-sentinel/latest.json?v=${bust}`, { cache: "no-store" }),
        fetch(`${base}radar/index.json?v=${bust}`, { cache: "no-store" })
      ]);
      const d1 = r1.ok ? await r1.json() : null;
      const d2 = r2.ok ? await r2.json() : [];
      setLatest(d1);
      setArchive(Array.isArray(d2) ? d2 : []);
    } catch {
      setLatest(null);
      setArchive([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

  const metrics = useMemo(() => {
    const v = latest?.volatility || {};
    const volPct = typeof latest?.volatilityPercentile === "number" ? latest.volatilityPercentile : null;
    return {
      stance: latest?.overallStance || "n/a",
      regime: toLabelRegime(latest?.regimeMode),
      volPct,
      nextRunAt: latest?.nextRunAt ? formatTime(latest.nextRunAt) : "n/a",
      hash: latest?.htmlSha256 ? String(latest.htmlSha256).slice(0, 10) : null
    };
  }, [latest]);

  const priceSeries = useMemo(() => {
    const s = safeArray(latest?.series?.portfolio30d);
    // if generator doesn't provide, synthesize from volatility series to avoid empty charts
    if(s.length) return s;
    const v = safeArray(latest?.volatility?.series);
    if(!v.length) return [];
    return v.map((x,i)=>({ d:i+1, v: 100 + (x - v[0]) }));
  }, [latest]);

  const optionsBars = useMemo(() => {
    const t = safeArray(latest?.tickers);
    return t.map(x=>({
      ticker: x.ticker,
      calls: x.options?.call || x.optionsCall || 0,
      puts: x.options?.put || x.optionsPut || 0
    }));
  }, [latest]);

  const riskBars = useMemo(() => {
    const t = safeArray(latest?.tickers);
    return t.map(x=>({ ticker: x.ticker, risk: x.risk_score || x.riskScore || 0 }));
  }, [latest]);

  const sendQuery = useCallback(() => {
    const q = query.trim();
    if(!q) return;
    setChat(c => [...c, { role: "user", text: q }]);
    setQuery("");

    // local "assistant" answer (no external calls)
    const a = buildAnswer(q, latest);
    const text = [a.title, ...a.lines].filter(Boolean).join("\n");
    window.setTimeout(() => {
      setChat(c => [...c, { role: "assistant", text }]);
    }, 220);
  }, [query, latest]);

  const keyIssues = safeArray(latest?.keyIssues).slice(0, 6);

  return (
    <div className={`intelHub ${isDark ? "dark" : "light"}`}>
      <div className="intelTopbar">
        <button className="btnGhost" onClick={onBack}><ArrowLeft size={16}/> Back</button>
        <div className="intelTitle">FORTIFY INTEL</div>
        <div className="intelTopActions">
          <button className="btnGhost" onClick={load} title="Refresh"><RefreshCw size={16}/></button>
        </div>
      </div>

      <div className="intelSearchRow">
        <div className="intelSearch">
          <Search size={16} />
          <input
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            onKeyDown={(e)=>{ if(e.key==="Enter") sendQuery(); }}
            placeholder='Ask: "what’s the regime today?" or "show me PLTR"'
          />
          <button className="btnPrimary" onClick={sendQuery}><Sparkles size={16}/> Ask</button>
        </div>
      </div>

      <div className="intelTabs">
        {["today","tickers","archive"].map(x=>(
          <button key={x} className={`tab ${tab===x?"active":""}`} onClick={()=>setTab(x)}>
            {x.toUpperCase()}
          </button>
        ))}
      </div>

      {loading && <div className="intelCard">Loading intel…</div>}

      {!loading && (
        <div className="intelGrid">
          <div className="intelMain">
            {tab === "today" && (
              <>
                <div className="intelCard animIn">
                  <div className="metricRow">
                    <div className="metric">
                      <div className="k">STANCE</div>
                      <div className="v">{metrics.stance}</div>
                    </div>
                    <div className={`metric regime ${metrics.regime.toLowerCase()}`}>
                      <div className="k">REGIME</div>
                      <div className="v">{metrics.regime}</div>
                    </div>
                    <div className="metric">
                      <div className="k">VOL</div>
                      <div className="v">{metrics.volPct !== null ? `${metrics.volPct}th pct` : "n/a"}</div>
                    </div>
                    <div className="metric">
                      <div className="k">NEXT RUN</div>
                      <div className="v">{metrics.nextRunAt}</div>
                    </div>
                    <div className="metric">
                      <div className="k">HASH</div>
                      <div className="v">{metrics.hash ? `#${metrics.hash}` : "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="intelCard animIn">
                  <div className="cardHead">PORTFOLIO CONTEXT</div>
                  {priceSeries.length ? (
                    <div style={{height:220}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={priceSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="intelFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(103,183,255,0.55)" />
                              <stop offset="90%" stopColor="rgba(103,183,255,0.02)" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(31,42,53,0.6)" strokeDasharray="3 3" />
                          <XAxis dataKey={priceSeries[0]?.date ? "date" : "d"} hide />
                          <YAxis hide domain={["auto","auto"]} />
                          <Tooltip />
                          <Area type="monotone" dataKey={priceSeries[0]?.value ? "value" : "v"} stroke="rgba(103,183,255,0.95)" fill="url(#intelFill)" isAnimationActive />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="muted">No series available yet.</div>
                  )}
                </div>

                <div className="twoCol">
                  <div className="intelCard animIn">
                    <div className="cardHead">OPTIONS (CALL vs PUT)</div>
                    <div style={{height:220}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={optionsBars} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid stroke="rgba(31,42,53,0.6)" strokeDasharray="3 3" />
                          <XAxis dataKey="ticker" />
                          <YAxis hide />
                          <Tooltip />
                          <Bar dataKey="calls" fill="rgba(103,183,255,0.9)" isAnimationActive />
                          <Bar dataKey="puts" fill="rgba(255,92,122,0.85)" isAnimationActive />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="intelCard animIn">
                    <div className="cardHead">RISK BAR</div>
                    <div style={{height:220}}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskBars} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid stroke="rgba(31,42,53,0.6)" strokeDasharray="3 3" />
                          <XAxis dataKey="ticker" />
                          <YAxis hide domain={[0,100]} />
                          <Tooltip />
                          <Bar dataKey="risk" fill="rgba(46,229,157,0.85)" isAnimationActive />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="intelCard animIn">
                  <div className="cardHead">KEY ISSUES</div>
                  {keyIssues.length ? (
                    <div className="issues">
                      {keyIssues.map((i, idx)=>(
                        <div className="issue" key={idx}>
                          <div className="bull"><span className="tag bullTag">BULL</span> {i.bull || i[0]}</div>
                          <div className="bear"><span className="tag bearTag">BEAR</span> {i.bear || i[1]}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">No key issues available yet.</div>
                  )}
                </div>
              </>
            )}

            {tab === "tickers" && (
              <div className="intelCard animIn">
                <div className="cardHead">TICKERS</div>
                <div className="tickerList">
                  {safeArray(latest?.tickers).map((t)=>(
                    <div className="tickerRow" key={t.ticker}>
                      <div className="tickerLeft">
                        <div className="sym">{t.ticker}</div>
                        <div className="name">{t.name || ""}</div>
                      </div>
                      <div className="tickerRight">
                        <span className="pill">{t.news_class || t.newsClass || "—"}</span>
                        <span className="pill">{t.risk_level || t.riskLevel || "—"}</span>
                        <span className="pill">{t.action || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "archive" && (
              <div className="intelCard animIn">
                <div className="cardHead">ARCHIVE</div>
                <div className="archiveList">
                  {archive.length ? archive.slice(0,60).map((e, idx)=>{
                    const file = e.file || e;
                    const sha = e.sha256 ? String(e.sha256).slice(0,10) : "";
                    return (
                      <a className="archiveRow" key={idx} href={`/radar/${file}`} target="_blank" rel="noreferrer">
                        <span>{file}</span>
                        <span className="muted">{sha ? `#${sha}` : ""}</span>
                      </a>
                    );
                  }) : <div className="muted">No archive index yet.</div>}
                </div>
              </div>
            )}
          </div>

          <div className="intelSide">
            <div className="intelCard assistant animIn">
              <div className="cardHead">ASSISTANT</div>
              <div className="chat" ref={chatRef}>
                {chat.map((m, idx)=>(
                  <div key={idx} className={`msg ${m.role}`}>
                    <pre>{m.text}</pre>
                  </div>
                ))}
              </div>
              <div className="quickRow">
                {["regime today","top bullish tickers","highest risk","options signals"].map((x)=>(
                  <button key={x} className="btnGhost small" onClick={()=>{ setQuery(x); }}>
                    {x}
                  </button>
                ))}
              </div>
            </div>

            <div className="intelCard animIn">
              <div className="cardHead">SOURCE LINKS</div>
              <div className="muted">Primary source: /macro-sentinel/latest.json</div>
              <div className="muted">Archive: /radar/index.json</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
