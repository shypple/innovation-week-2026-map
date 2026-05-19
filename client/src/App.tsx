import { useCallback, useEffect, useMemo, useState } from "react";
import { RiskMap } from "./components/RiskMap";
import type { EvaluateResponse, GoodsBucket, ParseAndEvaluateResponse, RiskTier } from "./types";

const GOODS: { value: GoodsBucket; label: string }[] = [
  { value: "general", label: "General cargo" },
  { value: "dual_use", label: "Dual-use / export-control sensitive" },
  { value: "defense", label: "Defense / military" },
  { value: "energy_oil_gas", label: "Energy (oil & gas)" },
  { value: "financial", label: "Financial / services" },
  { value: "luxury_consumer", label: "Luxury / consumer (sanctions-sensitive categories)" },
  { value: "tech_software", label: "Technology / software" },
  { value: "unknown", label: "Unknown / not classified" },
];

function tierBadge(tier: RiskTier): { bg: string; fg: string } {
  if (tier === "high") return { bg: "#fee2e2", fg: "#991b1b" };
  if (tier === "elevated") return { bg: "#ffedd5", fg: "#9a3412" };
  if (tier === "low") return { bg: "#dcfce7", fg: "#166534" };
  return { bg: "#f1f5f9", fg: "#475569" };
}

export default function App() {
  const [tiers, setTiers] = useState<Record<string, RiskTier>>({});
  const [destinationIso2, setDestinationIso2] = useState<string>("DE");
  const [goodsBucket, setGoodsBucket] = useState<GoodsBucket>("general");
  const [freeText, setFreeText] = useState<string>(
    "Customer asks if we can ship dual-use electronics from NL to CN for Acme Corp.",
  );
  const [evaluate, setEvaluate] = useState<EvaluateResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usedLlm, setUsedLlm] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/map-risk");
        if (!res.ok) throw new Error(`map-risk ${res.status}`);
        const data = (await res.json()) as { tiers: Record<string, RiskTier> };
        if (!cancelled) setTiers(data.tiers);
      } catch {
        if (!cancelled) setStatus("Could not load map tiers — is the API running on :8787?");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIso2 = useMemo(() => destinationIso2.toUpperCase(), [destinationIso2]);

  const runEvaluate = useCallback(async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinationIso2: selectedIso2,
          goodsBucket,
        }),
      });
      if (!res.ok) throw new Error(`evaluate ${res.status}`);
      const data = (await res.json()) as EvaluateResponse;
      setEvaluate(data);
      setUsedLlm(null);
    } catch {
      setStatus("Evaluate failed — check API logs.");
    } finally {
      setBusy(false);
    }
  }, [goodsBucket, selectedIso2]);

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
      if (data.parsed.destinationIso2) {
        setDestinationIso2(data.parsed.destinationIso2);
      }
      setGoodsBucket(data.parsed.goodsBucket);
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
          Innovation-week demo: structured triage + optional LLM parsing + interactive map.{" "}
          <strong>Not legal advice</strong> — seeded country tiers are placeholders. Always involve compliance
          for real shipments.
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
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>EU sanctions context (map)</h2>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              Click a country to set destination ISO2
            </div>
          </div>
          <RiskMap tiers={tiers} selectedIso2={selectedIso2} onSelectIso2={setDestinationIso2} />
        </section>

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 14,
              background: "var(--card)",
              boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Manual inputs</h2>
            <label style={{ display: "grid", gap: 6, marginBottom: 10, fontSize: 13 }}>
              Destination (ISO2)
              <input
                value={destinationIso2}
                onChange={(e) => setDestinationIso2(e.target.value.toUpperCase())}
                maxLength={2}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid var(--border)`,
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, marginBottom: 12, fontSize: 13 }}>
              Goods bucket
              <select
                value={goodsBucket}
                onChange={(e) => setGoodsBucket(e.target.value as GoodsBucket)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid var(--border)`,
                  background: "white",
                }}
              >
                {GOODS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void runEvaluate()}
              disabled={busy || selectedIso2.length !== 2}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: busy ? "#94a3b8" : "var(--accent)",
                color: "white",
                fontWeight: 600,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Run deterministic evaluation
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
              <p style={{ margin: 0, color: "var(--muted)" }}>Run an evaluation to see outputs.</p>
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
                      Parse: {usedLlm ? "LLM" : "heuristic"}
                    </span>
                  ) : null}
                </div>

                <p style={{ margin: 0, lineHeight: 1.6 }}>{evaluate.result.summary}</p>

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
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Escalation checklist</div>
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
