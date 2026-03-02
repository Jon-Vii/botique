import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C, FONT } from "../theme";
import { Cursor, GridBackground, Vignette, Scanlines, StatusLabel } from "../lib";

interface ThoughtLine {
  text: string;
  delay: number;
  color?: string;
  indent?: number;
  bold?: boolean;
}

const THOUGHTS: ThoughtLine[] = [
  { text: "analyzing briefing...", delay: 0, color: C.dim },
  { text: "", delay: 10 },
  { text: "3 orders yesterday is decent but $22.50 AOV is below category avg.", delay: 14, color: C.text },
  { text: "", delay: 24 },
  { text: "Mushroom Planter: 47 views → 2 fav → 1 order = 2.1% conversion", delay: 28, color: C.text },
  { text: "  → price sensitivity? $24.99 may be too high for category", delay: 38, color: C.orange },
  { text: "  → competitors average $18-22 for similar items", delay: 48, color: C.muted },
  { text: "", delay: 56 },
  { text: "Mini Succulent Pot: 31 views → 5 fav → 2 orders = 6.5% cvr", delay: 60, color: C.green },
  { text: "  → strong performer but only 2 units left ⚠", delay: 70, color: C.amber },
  { text: "", delay: 78 },
  { text: "cottagecore trending at 1.35× demand multiplier", delay: 82, color: C.orange },
  { text: "  → create cottagecore planter to capture trend traffic", delay: 92, color: C.text },
  { text: "", delay: 100 },
  { text: "PRIORITY:", delay: 108, color: C.orange, bold: true },
  { text: "  1. queue_production for Mini Succulent Pot (prevent stockout)", delay: 114, color: C.text },
  { text: "  2. update_listing Mushroom Planter $24.99 → $19.99", delay: 124, color: C.text },
  { text: "  3. create_draft_listing cottagecore planter", delay: 134, color: C.text },
  { text: "  4. queue_production for new listing", delay: 144, color: C.text },
  { text: "  5. get_shop_dashboard — verify state", delay: 154, color: C.text },
  { text: "", delay: 162 },
  { text: "executing workday...", delay: 170, color: C.orange, bold: true },
];

export const ReasoningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Scroll as content grows
  const scrollY = interpolate(frame, [60, 190], [0, -260], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  // Pulsing orange line on left — the "attention" indicator
  const pulseOpacity = interpolate(
    Math.sin(frame * 0.12),
    [-1, 1],
    [0.15, 0.5]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <GridBackground opacity={0.02} />
      <Scanlines />

      {/* Left attention line */}
      <div
        style={{
          position: "absolute",
          left: 52,
          top: 60,
          bottom: 60,
          width: 2,
          background: C.orange,
          opacity: pulseOpacity,
          boxShadow: `0 0 12px ${C.orange}`,
        }}
      />

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
        <StatusLabel text="reasoning" color={C.violet} bg="rgba(139,92,246,0.15)" />
        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.dim }}>
          chain-of-thought · pre-action planning
        </span>
      </div>

      {/* Thought stream */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 72,
          right: 80,
          bottom: 40,
          overflow: "hidden",
          opacity: fadeIn,
        }}
      >
        <div style={{ transform: `translateY(${scrollY}px)` }}>
          {THOUGHTS.map((line, i) => {
            if (frame < line.delay) return null;
            if (line.text === "") return <div key={i} style={{ height: 8 }} />;

            const elapsed = frame - line.delay;
            const charCount = Math.min(
              line.text.length,
              Math.floor(elapsed * 2.8)
            );
            const lineOpacity = interpolate(elapsed, [0, 4], [0, 1], {
              extrapolateRight: "clamp",
            });

            const isLast = i === THOUGHTS.length - 1;
            const isDone = charCount >= line.text.length;

            return (
              <div
                key={i}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 16,
                  fontWeight: line.bold ? 600 : 400,
                  lineHeight: 1.9,
                  color: line.color ?? C.text,
                  opacity: lineOpacity,
                  letterSpacing: "0.01em",
                  textShadow:
                    line.color === C.orange
                      ? `0 0 16px rgba(255,112,0,0.2)`
                      : "none",
                }}
              >
                {line.text.slice(0, charCount)}
                {isLast && isDone && <Cursor />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fade out */}
      <AbsoluteFill
        style={{
          backgroundColor: C.bg,
          opacity: interpolate(frame, [195, 210], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Vignette intensity={0.4} />
    </AbsoluteFill>
  );
};
