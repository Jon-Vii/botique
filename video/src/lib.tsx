import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C, FONT } from "./theme";

// ── Typing effect ──────────────────────────────────────

export const TypeWriter: React.FC<{
  text: string;
  startFrame?: number;
  speed?: number;
  style?: React.CSSProperties;
  cursor?: boolean;
}> = ({ text, startFrame = 0, speed = 1.5, style, cursor = false }) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(text.length, Math.floor(elapsed * speed));
  const done = charCount >= text.length;

  return (
    <span style={style}>
      {text.slice(0, charCount)}
      {cursor && <Cursor blink={done} />}
    </span>
  );
};

// ── Multi-line typing block ────────────────────────────

export const TypeWriterBlock: React.FC<{
  lines: Array<{ text: string; color?: string; indent?: number }>;
  lineDelay?: number;
  speed?: number;
  fontSize?: number;
  lineHeight?: number;
}> = ({ lines, lineDelay = 18, speed = 2, fontSize = 20, lineHeight = 1.7 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize,
        lineHeight,
        color: C.text,
      }}
    >
      {lines.map((line, i) => {
        const lineStart = i * lineDelay;
        if (frame < lineStart) return null;
        const elapsed = frame - lineStart;
        const charCount = Math.min(
          line.text.length,
          Math.floor(elapsed * speed)
        );

        return (
          <div
            key={i}
            style={{
              paddingLeft: (line.indent ?? 0) * 16,
              color: line.color ?? C.text,
              opacity: interpolate(elapsed, [0, 4], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {line.text.slice(0, charCount)}
          </div>
        );
      })}
    </div>
  );
};

// ── Blinking cursor ────────────────────────────────────

export const Cursor: React.FC<{ blink?: boolean; color?: string }> = ({
  blink = true,
  color = C.orange,
}) => {
  const frame = useCurrentFrame();
  const opacity = blink ? (Math.floor(frame / 8) % 2 === 0 ? 1 : 0) : 1;
  return <span style={{ color, opacity }}>▌</span>;
};

// ── Grid background ────────────────────────────────────

export const GridBackground: React.FC<{ opacity?: number }> = ({
  opacity: op = 0.04,
}) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,112,0,${op}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,112,0,${op}) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,112,0,${op * 0.35}) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,112,0,${op * 0.35}) 1px, transparent 1px)
          `,
          backgroundSize: "16px 16px",
        }}
      />
    </AbsoluteFill>
  );
};

// ── Scanlines overlay ──────────────────────────────────

export const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.015) 2px,
        rgba(0, 0, 0, 0.015) 4px
      )`,
      pointerEvents: "none",
    }}
  />
);

// ── Vignette ───────────────────────────────────────────

export const Vignette: React.FC<{ intensity?: number }> = ({
  intensity = 0.5,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${intensity}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

// ── Fade wrapper ───────────────────────────────────────

export const FadeIn: React.FC<{
  children: React.ReactNode;
  durationFrames?: number;
  delay?: number;
}> = ({ children, durationFrames = 15, delay = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{ opacity }}>{children}</div>;
};

// ── Slide-up entrance ──────────────────────────────────

export const SlideUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  distance?: number;
}> = ({ children, delay = 0, distance = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = Math.max(0, frame - delay);
  const progress = interpolate(elapsed, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${(1 - progress) * distance}px)`,
      }}
    >
      {children}
    </div>
  );
};

// ── Orange glow box ────────────────────────────────────

export const GlowBox: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  pulseFrame?: number;
}> = ({ children, style, pulseFrame }) => {
  const frame = useCurrentFrame();
  const glowIntensity =
    pulseFrame !== undefined
      ? interpolate(
          Math.abs(frame - pulseFrame),
          [0, 20],
          [0.4, 0.08],
          { extrapolateRight: "clamp" }
        )
      : 0.08;

  return (
    <div
      style={{
        background: C.bgLighter,
        border: `1px solid ${C.borderOrange}`,
        boxShadow: `0 0 ${glowIntensity * 60}px rgba(255,112,0,${glowIntensity})`,
        padding: "16px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── Status label ───────────────────────────────────────

export const StatusLabel: React.FC<{
  text: string;
  color?: string;
  bg?: string;
}> = ({ text, color = C.orange, bg = C.orangeDim }) => (
  <span
    style={{
      fontFamily: FONT.mono,
      fontSize: 11,
      fontWeight: 500,
      color,
      background: bg,
      padding: "3px 8px",
      letterSpacing: "0.05em",
      textTransform: "uppercase",
    }}
  >
    {text}
  </span>
);

// ── Number counter animation ───────────────────────────

export const Counter: React.FC<{
  from: number;
  to: number;
  startFrame?: number;
  durationFrames?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: React.CSSProperties;
}> = ({
  from,
  to,
  startFrame = 0,
  durationFrames = 30,
  prefix = "",
  suffix = "",
  decimals = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame - startFrame,
    [0, durationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    }
  );
  const value = from + (to - from) * progress;

  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontVariantNumeric: "tabular-nums",
        ...style,
      }}
    >
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
};

// ── Horizontal rule ────────────────────────────────────

export const Rule: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame - delay, [0, 20], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <div
      style={{
        height: 1,
        background: `linear-gradient(90deg, ${C.orange}, ${C.border})`,
        width: `${width}%`,
        margin: "12px 0",
      }}
    />
  );
};

// ── Frame counter (subtle HUD element) ─────────────────

export const FrameCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seconds = (frame / fps).toFixed(1);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 24,
        fontFamily: FONT.mono,
        fontSize: 11,
        color: C.dim,
        letterSpacing: "0.04em",
        opacity: 0.6,
      }}
    >
      {String(frame).padStart(4, "0")}f · {seconds}s
    </div>
  );
};
