import type { RiskTier, SanctionsGoodsHint } from "../types";

export type CountryTooltipState = {
  iso2: string;
  name: string;
  tier: RiskTier | undefined;
  /** Viewport coordinates for `position: fixed` (avoids clipping by map overflow). */
  clientX: number;
  clientY: number;
};

type Props = {
  tooltip: CountryTooltipState;
  hints: SanctionsGoodsHint[];
  sanctionsMapUrl: string;
  onClose: () => void;
};

function tierLabel(tier: RiskTier | undefined): string {
  if (tier === "high") return "High restrictions (demo seed)";
  if (tier === "elevated") return "Elevated restrictions (demo seed)";
  return "Not in demo seed";
}

function isSanctionedTier(tier: RiskTier | undefined): boolean {
  return tier === "high" || tier === "elevated";
}

export function CountryTooltip({ tooltip, hints, sanctionsMapUrl, onClose }: Props) {
  const sanctioned = isSanctionedTier(tooltip.tier);
  const width = 320;
  const margin = 12;
  const left = Math.min(
    Math.max(margin, tooltip.clientX - width / 2),
    window.innerWidth - width - margin,
  );
  const top = Math.min(tooltip.clientY + 14, window.innerHeight - margin);

  return (
    <>
      <button
        type="button"
        aria-label="Close country details"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          border: "none",
          background: "transparent",
          cursor: "default",
        }}
      />
      <div
        role="dialog"
        aria-label={`Sanctions context for ${tooltip.name}`}
        style={{
          position: "fixed",
          left,
          top,
          zIndex: 50,
          width,
          maxWidth: "calc(100% - 16px)",
          padding: 14,
          borderRadius: 12,
          border: `1px solid ${sanctioned ? "#fecaca" : "var(--border)"}`,
          background: "var(--card)",
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.18)",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          {tooltip.name}{" "}
          <span style={{ fontWeight: 500, color: "var(--muted)", fontSize: 13 }}>({tooltip.iso2})</span>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            marginBottom: sanctioned ? 10 : 8,
            color:
              tooltip.tier === "high" ? "#b91c1c" : tooltip.tier === "elevated" ? "#c2410c" : "var(--muted)",
          }}
        >
          {tierLabel(tooltip.tier)}
        </div>

        {sanctioned ? (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
              Goods categories often restricted or licensing-sensitive toward this jurisdiction — verify on the
              EU Sanctions Map.
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {hints.map((h) => (
                <li
                  key={h.id}
                  style={{
                    padding: "8px 0",
                    borderTop: "1px solid var(--border)",
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{h.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{h.note}</div>
                </li>
              ))}
            </ul>
            <a
              href={sanctionsMapUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 600 }}
            >
              Open EU Sanctions Map →
            </a>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
            This country is not highlighted in the demo dataset. Click a{" "}
            <span style={{ color: "#b91c1c", fontWeight: 600 }}>red</span> or{" "}
            <span style={{ color: "#ea580c", fontWeight: 600 }}>orange</span> territory to see sensitive goods
            categories.
          </p>
        )}
      </div>
    </>
  );
}
