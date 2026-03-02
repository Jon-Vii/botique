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
  Rule,
} from "../lib";

interface BriefLine {
  text: string;
  delay: number;
  color?: string;
  indent?: number;
  size?: number;
  weight?: number;
  isHeader?: boolean;
}

const BRIEFING: BriefLine[] = [
  // Header
  { text: "# Terra & Tide Pottery workday", delay: 0, color: C.orange, size: 26, weight: 700, isHeader: true },
  { text: "Day 14 · 2025-01-14 · Objective: Grow ending balance", delay: 12, color: C.dim, size: 14 },
  // Status
  { text: "Available balance is $847.20; 3 orders brought in $67.50 yesterday.", delay: 24, color: C.text, size: 16 },
  // Morning brief header
  { text: "## Morning brief", delay: 40, color: C.muted, size: 18, weight: 600 },
  { text: "Cash: $847.20 available, $124.50 pending", delay: 50, color: C.text, indent: 1 },
  { text: "Yesterday: 3 orders, $67.50 revenue, $22.50 avg", delay: 60, color: C.text, indent: 1 },
  // Listing movement
  { text: "Listing movement:", delay: 74, color: C.muted, indent: 1 },
  { text: "Mushroom Planter (active): +47 views, +2 fav, +1 orders", delay: 82, color: C.text, indent: 2 },
  { text: "Geometric Wall Shelf (active): +23 views, 0 fav", delay: 90, color: C.dim, indent: 2 },
  { text: "Mini Succulent Pot (active): +31 views, +5 fav, +2 orders", delay: 98, color: C.green, indent: 2 },
  // Market watch
  { text: "Market watch:", delay: 114, color: C.muted, indent: 1 },
  { text: "Cottagecore planters [HIGH]: demand ×1.35", delay: 122, color: C.orange, indent: 2 },
  { text: "Minimalist desk accessories [watch]: demand ×1.10", delay: 132, color: C.dim, indent: 2 },
  // Production
  { text: "Production watch:", delay: 146, color: C.muted, indent: 1 },
  { text: "⚠ Low-stock: Mini Succulent Pot (2 units remaining)", delay: 154, color: C.amber, indent: 2 },
  { text: "1 production job queued (3 stock units)", delay: 164, color: C.text, indent: 2 },
  // Scratchpad
  { text: "## Scratchpad", delay: 182, color: C.muted, size: 18, weight: 600 },
  { text: "Revenue growing but slowly. Need to diversify into trending", delay: 192, color: C.dim, indent: 1 },
  { text: "categories. Mushroom Planter gets views but low conversion —", delay: 200, color: C.dim, indent: 1 },
  { text: "test lower price. Consider cottagecore line for trend capture.", delay: 208, color: C.dim, indent: 1 },
  // Today
  { text: "## Today", delay: 228, color: C.orange, size: 18, weight: 600 },
  { text: "Set the highest-leverage priorities for this workday.", delay: 238, color: C.text, indent: 1 },
];

export const BriefingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Slow scroll as content accumulates
  const scrollY = interpolate(frame, [80, 250], [0, -180], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <GridBackground opacity={0.02} />
      <Scanlines />

      {/* Header bar */}
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
        <StatusLabel text="briefing" color={C.orange} bg={C.orangeDim} />
        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.dim }}>
          shop_id:7 · day 14 · 5 work slots available
        </span>
      </div>

      {/* Briefing content */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 80,
          right: 80,
          bottom: 40,
          overflow: "hidden",
          opacity: fadeIn,
        }}
      >
        <div style={{ transform: `translateY(${scrollY}px)` }}>
          {BRIEFING.map((line, i) => {
            if (frame < line.delay) return null;
            const elapsed = frame - line.delay;
            const charCount = Math.min(
              line.text.length,
              Math.floor(elapsed * 2.2)
            );
            const lineOpacity = interpolate(elapsed, [0, 6], [0, 1], {
              extrapolateRight: "clamp",
            });

            const isHighlight =
              line.color === C.orange || line.color === C.green || line.color === C.amber;

            return (
              <div
                key={i}
                style={{
                  fontFamily: FONT.mono,
                  fontSize: line.size ?? 15,
                  fontWeight: line.weight ?? 400,
                  lineHeight: 1.8,
                  color: line.color ?? C.text,
                  opacity: lineOpacity,
                  paddingLeft: (line.indent ?? 0) * 20,
                  marginTop: line.isHeader ? 8 : 0,
                  textShadow: isHighlight
                    ? `0 0 20px ${line.color}33`
                    : "none",
                }}
              >
                {line.text.slice(0, charCount)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fade out */}
      <AbsoluteFill
        style={{
          backgroundColor: C.bg,
          opacity: interpolate(frame, [255, 270], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Vignette intensity={0.4} />
    </AbsoluteFill>
  );
};
