import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C, FONT } from "../theme";
import { Cursor, GridBackground, Vignette, Scanlines } from "../lib";

const BOOT_LINES = [
  { text: "> agent_runtime v0.3.1", delay: 8, color: C.dim },
  { text: "> provider: mistral-medium-latest", delay: 20, color: C.text },
  { text: '> shop_id: 7 → "Terra & Tide Pottery"', delay: 34, color: C.orange },
  { text: "> scenario: operate | work_slots: 5", delay: 48, color: C.text },
  { text: "> connecting to platform server...", delay: 58, color: C.dim },
  { text: "> briefing_generated ✓", delay: 72, color: C.green },
];

export const BootScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const containerOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <GridBackground opacity={0.025} />
      <Scanlines />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 720,
          opacity: containerOpacity,
        }}
      >
        {BOOT_LINES.map((line, i) => {
          if (frame < line.delay) return null;
          const elapsed = frame - line.delay;
          const charCount = Math.min(
            line.text.length,
            Math.floor(elapsed * 2.5)
          );
          const lineOpacity = interpolate(elapsed, [0, 3], [0, 1], {
            extrapolateRight: "clamp",
          });
          const isLast = i === BOOT_LINES.length - 1;
          const isDone = charCount >= line.text.length;

          return (
            <div
              key={i}
              style={{
                fontFamily: FONT.mono,
                fontSize: 20,
                lineHeight: 2,
                color: line.color,
                opacity: lineOpacity,
                letterSpacing: "0.02em",
              }}
            >
              {line.text.slice(0, charCount)}
              {isLast && isDone && <Cursor />}
            </div>
          );
        })}
      </div>

      {/* Fade out at end */}
      <AbsoluteFill
        style={{
          backgroundColor: C.bg,
          opacity: interpolate(frame, [75, 90], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Vignette intensity={0.6} />
    </AbsoluteFill>
  );
};
