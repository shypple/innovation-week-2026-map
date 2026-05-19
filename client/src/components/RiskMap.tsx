import { memo, useMemo, useRef, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import type { RiskTier } from "../types";
import { CountryTooltip, type CountryTooltipState } from "./CountryTooltip";
import { ISO_NUMERIC_TO_ISO2 } from "../data/isoNumericToIso2";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export type CountryClickPayload = {
  iso2: string;
  name: string;
  tier: RiskTier | undefined;
  clientX: number;
  clientY: number;
};

type GeoFeature = {
  rsmKey: string;
  id?: string | number;
  properties: Record<string, unknown>;
};

type Props = {
  tiers: Record<string, RiskTier>;
  selectedIso2: string | null;
  tooltip: CountryTooltipState | null;
  goodsHints: { id: string; label: string; note: string; sanctionsMapUrl: string }[];
  sanctionsMapUrl: string;
  onCountryClick: (payload: CountryClickPayload) => void;
  onCloseTooltip: () => void;
};

function tierColor(tier: RiskTier | undefined): string {
  if (tier === "high") return "#ef4444";
  if (tier === "elevated") return "#fb923c";
  return "#e2e8f0";
}

function tierStroke(tier: RiskTier | undefined, selected: boolean): { stroke: string; strokeWidth: number } {
  if (selected) return { stroke: "#0f172a", strokeWidth: 2.2 };
  if (tier === "high") return { stroke: "#7f1d1d", strokeWidth: 1.2 };
  if (tier === "elevated") return { stroke: "#9a3412", strokeWidth: 1 };
  return { stroke: "#94a3b8", strokeWidth: 0.4 };
}

function isSanctioned(tier: RiskTier | undefined): boolean {
  return tier === "high" || tier === "elevated";
}

/** world-atlas uses numeric ISO 3166-1 ids on geometries, not ISO_A2 in properties. */
function readIso2(geo: GeoFeature): string | null {
  if (geo.id != null) {
    const fromNumeric = ISO_NUMERIC_TO_ISO2[String(geo.id)];
    if (fromNumeric) return fromNumeric;
  }
  const legacy = geo.properties["ISO_A2"];
  if (typeof legacy === "string") {
    const trimmed = legacy.trim().toUpperCase();
    if (trimmed && trimmed !== "-99") return trimmed;
  }
  return null;
}

function readName(geo: GeoFeature): string {
  const name = geo.properties["name"];
  return typeof name === "string" ? name : "Unknown";
}

export const RiskMap = memo(function RiskMap({
  tiers,
  selectedIso2,
  tooltip,
  goodsHints,
  sanctionsMapUrl,
  onCountryClick,
  onCloseTooltip,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  const legend = useMemo(
    () => [
      { label: "High restrictions (demo)", color: tierColor("high"), stroke: "#7f1d1d" },
      { label: "Elevated restrictions (demo)", color: tierColor("elevated"), stroke: "#9a3412" },
      { label: "Other countries", color: tierColor(undefined), stroke: "#94a3b8" },
    ],
    [],
  );

  const handleCountryPointer = (geo: GeoFeature, evt: MouseEvent<SVGPathElement>) => {
    const iso = readIso2(geo);
    if (!iso) return;
    evt.stopPropagation();
    evt.preventDefault();
    onCountryClick({
      iso2: iso,
      name: readName(geo),
      tier: tiers[iso],
      clientX: evt.clientX,
      clientY: evt.clientY,
    });
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <div
        ref={mapRef}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          background: "#cbd5e1",
        }}
      >
        <ComposableMap
          projectionConfig={{ scale: 145, center: [0, 20] }}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <ZoomableGroup
            zoom={1}
            minZoom={0.8}
            maxZoom={4}
            filterZoomEvent={(evt: { target?: EventTarget; ctrlKey?: boolean; button?: number } | null) => {
              const target = evt?.target;
              if (target instanceof Element && target.classList.contains("rsm-geography")) {
                return false;
              }
              return evt ? !evt.ctrlKey && !evt.button : false;
            }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: GeoFeature[] }) =>
                geographies.map((geo) => {
                  const iso = readIso2(geo);
                  const tier = iso ? tiers[iso] : undefined;
                  const fill = tierColor(tier);
                  const isSelected = Boolean(iso && iso === selectedIso2);
                  const { stroke, strokeWidth } = tierStroke(tier, isSelected);
                  const sanctioned = isSanctioned(tier);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      style={{
                        default: {
                          outline: "none",
                          cursor: iso ? "pointer" : "default",
                          pointerEvents: iso ? "all" : "none",
                        },
                        hover: {
                          outline: "none",
                          fill: sanctioned
                            ? tier === "high"
                              ? "#dc2626"
                              : "#f97316"
                            : "#f8fafc",
                          strokeWidth: strokeWidth + 0.5,
                          cursor: "pointer",
                        },
                        pressed: {
                          outline: "none",
                          fill: sanctioned ? "#b91c1c" : "#cbd5e1",
                        },
                      }}
                      onClick={(evt: MouseEvent<SVGPathElement>) => handleCountryPointer(geo, evt)}
                      onMouseUp={(evt: MouseEvent<SVGPathElement>) => {
                        if (evt.button === 0) handleCountryPointer(geo, evt);
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {tooltip ? (
        <CountryTooltip
          tooltip={tooltip}
          hints={goodsHints}
          sanctionsMapUrl={sanctionsMapUrl}
          onClose={onCloseTooltip}
        />
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 10,
          color: "var(--muted)",
          fontSize: 13,
        }}
      >
        {legend.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: item.color,
                border: `2px solid ${item.stroke}`,
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
