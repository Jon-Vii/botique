import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C, FONT } from "../theme";
import {
  GridBackground,
  Vignette,
  Scanlines,
  StatusLabel,
  Counter,
  Cursor,
} from "../lib";

const SCRATCHPAD_LINES = [
  "Day 14: Repriced Mushroom Planter to $19.99 to improve conversion.",
  "Created Cottagecore Mushroom House Planter (draft, listing 67).",
  "Queued production: 10× Mini Succulent Pot, 8× new planter.",
  "Tomorrow: activate listing 67 once production starts.",
  "Watch cottagecore trend — if it holds, create more in this line.",
];

interface SettlementRow {
  label: string;
  value: string;
  delta?: string;
  color?: string;
  delay: number;
}

const SETTLEMENT: SettlementRow[] = [
  { label: "orders", value: "4", delta: "+1", color: C.green, delay: 120 },
  { label: "revenue", value: "$82.30", delta: "+$14.80", color: C.green, delay: 130 },
  { label: "views", value: "124", color: C.text, delay: 140 },
  { label: "favorites", value: "9", color: C.text, delay: 148 },
  { label: "new review", value: '★★★★☆ "Love this little pot!"', color: C.amber, delay: 158 },
  { label: "production", value: "3 units completed", color: C.teal, delay: 168 },
  { label: "ending balance", value: "$929.50", delta: "+$82.30", color: C.orange, delay: 180 },
];

export const DayResolvesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <GridBackground opacity={0.02} />
      <Scanlines />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 44,
          background: C.bgLighter,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          gap: 12,
          zIndex: 10,
          opacity: fadeIn,
        }}
      >
        <StatusLabel text="settling" color={C.amber} bg="rgba(245,158,11,0.15)" />
        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.dim }}>
          turns_exhausted · day 14 resolution
        </span>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 80,
          right: 80,
          bottom: 40,
          display: "flex",
          gap: 60,
          opacity: fadeIn,
        }}
      >
        {/* Left: Scratchpad revision */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              color: C.dim,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            end-of-day scratchpad revision
          </div>

          <div
            style={{
              background: C.bgLighter,
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${C.violet}`,
              padding: "16px 20px",
            }}
          >
            {SCRATCHPAD_LINES.map((line, i) => {
              const lineDelay = 20 + i * 14;
              if (frame < lineDelay) return null;
              const elapsed = frame - lineDelay;
              const charCount = Math.min(
                line.length,
                Math.floor(elapsed * 2)
              );
              const opacity = interpolate(elapsed, [0, 4], [0, 1], {
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 14,
                    lineHeight: 1.8,
                    color: C.muted,
                    opacity,
                  }}
                >
                  {line.slice(0, charCount)}
                </div>
              );
            })}
          </div>

          {/* Overnight advancing */}
          {frame >= 95 && (
            <div
              style={{
                marginTop: 24,
                fontFamily: FONT.mono,
                fontSize: 14,
                color: C.dim,
                opacity: interpolate(frame - 95, [0, 10], [0, 1], {
                  extrapolateRight: "clamp",
                }),
              }}
            >
              simulation advancing to day 15...
              {frame >= 110 && <Cursor />}
            </div>
          )}
        </div>

        {/* Right: Settlement numbers */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              color: C.dim,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            day 14 settlement
          </div>

          <div
            style={{
              background: C.bgLighter,
              border: `1px solid ${C.borderOrange}`,
              padding: "20px 24px",
              boxShadow: `0 0 20px rgba(255,112,0,0.06)`,
            }}
          >
            {SETTLEMENT.map((row, i) => {
              if (frame < row.delay) return null;
              const elapsed = frame - row.delay;
              const opacity = interpolate(elapsed, [0, 8], [0, 1], {
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontFamily: FONT.mono,
                    fontSize: 15,
                    lineHeight: 2.2,
                    opacity,
                  }}
                >
                  <span style={{ color: C.dim }}>{row.label}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span
                      style={{
                        color: row.color ?? C.text,
                        fontWeight: row.label === "ending balance" ? 700 : 400,
                        fontSize: row.label === "ending balance" ? 18 : 15,
                        textShadow:
                          row.color === C.orange
                            ? "0 0 16px rgba(255,112,0,0.3)"
                            : "none",
                      }}
                    >
                      {row.value}
                    </span>
                    {row.delta && (
                      <span
                        style={{
                          fontSize: 12,
                          color: C.green,
                          opacity: 0.8,
                        }}
                      >
                        {row.delta}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fade out */}
      <AbsoluteFill
        style={{
          backgroundColor: C.bg,
          opacity: interpolate(frame, [285, 300], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Vignette intensity={0.4} />
    </AbsoluteFill>
  );
};
