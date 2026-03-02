import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C, FONT } from "../theme";
import { GridBackground, Vignette, Scanlines } from "../lib";

export const TitleCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title entrance
  const titleProgress = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Subtitle entrance
  const subProgress = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Tagline entrance
  const taglineProgress = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Bottom text
  const bottomProgress = interpolate(frame, [160, 190], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Orange line expands
  const lineWidth = interpolate(frame, [30, 70], [0, 280], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Subtle ambient glow pulse
  const glowPulse = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [0.03, 0.08]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <GridBackground opacity={0.02} />
      <Scanlines />

      {/* Ambient orange glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 40%, rgba(255,112,0,${glowPulse}) 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        {/* BOTIQUE title */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 96,
            fontWeight: 700,
            color: C.orange,
            letterSpacing: "0.18em",
            opacity: titleProgress,
            transform: `translateY(${(1 - titleProgress) * 20}px)`,
            textShadow: `0 0 40px rgba(255,112,0,0.3), 0 0 80px rgba(255,112,0,0.1)`,
          }}
        >
          BOTIQUE
        </div>

        {/* Orange line */}
        <div
          style={{
            width: lineWidth,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.orange}, transparent)`,
            margin: "16px auto",
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 20,
            fontWeight: 400,
            color: C.text,
            letterSpacing: "0.06em",
            opacity: subProgress,
            transform: `translateY(${(1 - subProgress) * 12}px)`,
            lineHeight: 1.8,
          }}
        >
          autonomous agents running shops
          <br />
          in a simulated marketplace
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 16,
            fontWeight: 400,
            color: C.dim,
            letterSpacing: "0.04em",
            marginTop: 32,
            opacity: taglineProgress,
            transform: `translateY(${(1 - taglineProgress) * 8}px)`,
            fontStyle: "italic",
          }}
        >
          what can a mind made of API calls build?
        </div>
      </div>

      {/* Bottom info */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: bottomProgress,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            color: C.dim,
            letterSpacing: "0.06em",
          }}
        >
          mistral worldwide hackathon 2026
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: C.border,
            marginTop: 8,
            letterSpacing: "0.04em",
          }}
        >
          mistral-medium-latest · mistral-small-latest · custom agent runtime
        </div>
      </div>

      {/* Final fade */}
      <AbsoluteFill
        style={{
          backgroundColor: C.bg,
          opacity: interpolate(frame, [310, 330], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Vignette intensity={0.5} />
    </AbsoluteFill>
  );
};
