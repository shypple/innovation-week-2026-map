import { useCallback, useEffect, useState } from "react";
import { RiskMap, type CountryClickPayload } from "./components/RiskMap";
import type { CountryTooltipState } from "./components/CountryTooltip";
import type { EvaluateResponse, ParseAndEvaluateResponse, RiskTier, SanctionsGoodsHint } from "./types";

function tierBadge(tier: string): { bg: string; fg: string } {
  if (tier === "high") return { bg: "#fee2e2", fg: "#991b1b" };
  if (tier === "elevated") return { bg: "#ffedd5", fg: "#9a3412" };
  if (tier === "low") return { bg: "#dcfce7", fg: "#166534" };
  return { bg: "#f1f5f9", fg: "#475569" };
}

export default function App() {
  const [tiers, setTiers] = useState<Record<string, RiskTier>>({});
  const [goodsHints, setGoodsHints] = useState<SanctionsGoodsHint[]>([]);
  const [sanctionsMapUrl, setSanctionsMapUrl] = useState("https://www.sanctionsmap.eu/");
  const [selectedIso2, setSelectedIso2] = useState<string | null>(null);
  const [mapTooltip, setMapTooltip] = useState<CountryTooltipState | null>(null);
  const [freeText, setFreeText] = useState<string>(
    "Customer asks if we can ship dual-use electronics from NL to CN for Acme Corp.",
  );
  const [evaluate, setEvaluate] = useState<EvaluateResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usedLlm, setUsedLlm] = useState<boolean | null>(null);
  const [llmCacheHit, setLlmCacheHit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [mapRes, hintsRes] = await Promise.all([
          fetch("/api/map-risk"),
          fetch("/api/sanctions-goods-hints"),
        ]);
        if (!mapRes.ok) throw new Error(`map-risk ${mapRes.status}`);
        const mapData = (await mapRes.json()) as { tiers: Record<string, RiskTier> };
        if (!cancelled) setTiers(mapData.tiers);

        if (hintsRes.ok) {
          const hintsData = (await hintsRes.json()) as {
            hints: SanctionsGoodsHint[];
            sanctionsMapUrl: string;
          };
          if (!cancelled) {
            setGoodsHints(hintsData.hints);
            setSanctionsMapUrl(hintsData.sanctionsMapUrl);
          }
        }
      } catch {
        if (!cancelled) setStatus("Could not load map data — is the API running on :8787?");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCountryClick = useCallback((payload: CountryClickPayload) => {
    setSelectedIso2(payload.iso2);
    setMapTooltip({
      iso2: payload.iso2,
      name: payload.name,
      tier: payload.tier,
      clientX: payload.clientX,
      clientY: payload.clientY,
    });
  }, []);

  const runParseAndEvaluate = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/parse-and-evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: freeText }),
      });
      if (!res.ok) throw new Error(`parse ${res.status}`);
      const data = (await res.json()) as ParseAndEvaluateResponse;
      setUsedLlm(data.usedLlm);
      setLlmCacheHit(Boolean(data.llmCacheHit));
      if (data.parsed.destinationIso2) {
        setSelectedIso2(data.parsed.destinationIso2);
        setMapTooltip(null);
      }
      if (data.evaluate) {
        setEvaluate(data.evaluate);
      } else {
        setEvaluate(null);
        setStatus(data.message ?? "Parse did not yield an evaluation.");
      }
    } catch {
      setStatus("Parse failed — check API logs.");
    } finally {
      setBusy(false);
    }
  }, [freeText]);

  const badge = evaluate ? tierBadge(evaluate.result.tier) : null;

  return (
    <div className="app-shell">
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 28, letterSpacing: -0.4 }}>Sanctions triage</h1>
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5, maxWidth: 900 }}>
          Click a <strong>highlighted</strong> country on the map to see goods categories that often need extra
          checks under EU restrictive measures. Paste a shipment question below for AI-assisted triage.{" "}
          <strong>Not legal advice</strong> — demo seed data only.
        </p>
      </header>

      <div className="app-grid">
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 14,
            background: "var(--card)",
            boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>EU sanctions map</h2>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Click a country for sensitive goods</div>
          </div>
          <RiskMap
            tiers={tiers}
            selectedIso2={selectedIso2}
            tooltip={mapTooltip}
            goodsHints={goodsHints}
            sanctionsMapUrl={sanctionsMapUrl}
            onCountryClick={handleCountryClick}
            onCloseTooltip={() => setMapTooltip(null)}
          />
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 14,
              background: "var(--card)",
              boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>AI-assisted parse</h2>
            <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              Paste an email or Slack question. With <code>OPENAI_API_KEY</code> on the API, this uses an LLM;
              otherwise it falls back to simple heuristics.
            </p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={7}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid var(--border)`,
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={() => void runParseAndEvaluate()}
              disabled={busy || !freeText.trim()}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid var(--border)`,
                background: "white",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Parse + evaluate
            </button>
          </div>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 14,
              background: "var(--card)",
              boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Result</h2>
            {status ? (
              <p style={{ margin: 0, color: "#b45309" }}>{status}</p>
            ) : !evaluate ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Run parse + evaluate, or explore sanctioned countries on the map.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Tier</span>
                  <span
                    style={{
                      fontWeight: 800,
                      letterSpacing: 0.3,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: badge?.bg,
                      color: badge?.fg,
                    }}
                  >
                    {evaluate.result.tier.toUpperCase()}
                  </span>
                  {usedLlm !== null ? (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      Parse: {!usedLlm ? "heuristic" : llmCacheHit ? "LLM (cached)" : "LLM"}
                    </span>
                  ) : null}
                </div>

                <p style={{ margin: 0, lineHeight: 1.6 }}>{evaluate.result.summary}</p>

                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  Goods bucket: <code>{evaluate.input.goodsBucket}</code>
                </p>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Rules</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {evaluate.result.ruleIds.map((r) => (
                      <li key={r} style={{ marginBottom: 4 }}>
                        <code>{r}</code>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Citations</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {evaluate.result.citations.map((c) => (
                      <li key={c.id} style={{ marginBottom: 6 }}>
                        <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                          {c.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    Escalation checklist
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {evaluate.result.checklist.map((item) => (
                      <li key={item} style={{ marginBottom: 6 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
