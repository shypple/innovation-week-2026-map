import { memo, useMemo } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import type { RiskTier } from "../types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type Props = {
  tiers: Record<string, RiskTier>;
  selectedIso2: string | null;
  onSelectIso2: (iso2: string) => void;
};

function tierColor(tier: RiskTier | undefined): string {
  if (tier === "high") return "#b91c1c";
  if (tier === "elevated") return "#ea580c";
  if (tier === "low") return "#bbf7d0";
  return "#e5e7eb";
}

function readIso2(geo: { properties: Record<string, unknown> }): string | null {
  const iso = geo.properties["ISO_A2"];
  if (typeof iso !== "string") return null;
  const trimmed = iso.trim().toUpperCase();
  if (!trimmed || trimmed === "-99") return null;
  return trimmed;
}

export const RiskMap = memo(function RiskMap({ tiers, selectedIso2, onSelectIso2 }: Props) {
  const legend = useMemo(
    () => [
      { label: "High (seeded demo)", color: tierColor("high") },
      { label: "Elevated (seeded demo)", color: tierColor("elevated") },
      { label: "Unknown / not in seed", color: tierColor("unknown") },
    ],
    [],
  );

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--card)",
        }}
      >
        <ComposableMap
          projectionConfig={{ scale: 145, center: [0, 20] }}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <ZoomableGroup zoom={1} minZoom={0.6} maxZoom={4}>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: { rsmKey: string; properties: Record<string, unknown> }[] }) =>
                geographies.map((geo) => {
                  const iso = readIso2(geo);
                  const tier = iso ? tiers[iso] : undefined;
                  const fill = tierColor(tier);
                  const isSelected = Boolean(iso && iso === selectedIso2);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#cbd5e1"
                      strokeWidth={isSelected ? 1.2 : 0.4}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", filter: "brightness(0.96)" },
                        pressed: { outline: "none" },
                      }}
                      onClick={() => {
                        if (iso) onSelectIso2(iso);
                      }}
                      title={
                        iso
                          ? `${iso} — ${tier ? `seed tier: ${tier}` : "not in demo seed"}`
                          : (geo.properties["NAME"] as string | undefined) ?? "Region"
                      }
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 10,
          color: "var(--muted)",
          fontSize: 13,
        }}
      >
        {legend.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
