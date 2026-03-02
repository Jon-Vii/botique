import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Sequence,
} from "remotion";
import { C, FONT } from "../theme";
import {
  GridBackground,
  Vignette,
  Scanlines,
  StatusLabel,
  GlowBox,
  Cursor,
} from "../lib";

interface ToolCallData {
  turn: number;
  name: string;
  args: string;
  result: string;
  resultColor?: string;
}

const TOOL_CALLS: ToolCallData[] = [
  {
    turn: 1,
    name: "queue_production",
    args: '{ listing_id: 23, units: 10, priority: "high" }',
    result:
      '→ queued: true, completion: day 16, capacity_remaining: 5',
    resultColor: C.green,
  },
  {
    turn: 2,
    name: "update_listing",
    args: '{ listing_id: 42, price: 19.99, tags: ["mushroom","planter","cottagecore"] }',
    result: "→ listing 42 updated, state: active, price: $19.99",
    resultColor: C.green,
  },
  {
    turn: 3,
    name: "create_draft_listing",
    args: '{ title: "Cottagecore Mushroom House Planter", price: 21.99, taxonomy_id: 3, fulfillment_mode: "stocked" }',
    result: "→ listing_id: 67 created, state: draft",
    resultColor: C.teal,
  },
  {
    turn: 4,
    name: "queue_production",
    args: "{ listing_id: 67, units: 8 }",
    result: "→ queued: true, completion: day 17, capacity_remaining: 0",
    resultColor: C.green,
  },
  {
    turn: 5,
    name: "get_shop_dashboard",
    args: "{}",
    result:
      "→ balance: $847.20, active: 3, draft: 1, queue: 2 jobs",
    resultColor: C.text,
  },
];

const FRAMES_PER_CALL = 102;

const SingleToolCall: React.FC<{
  data: ToolCallData;
  globalTurnFrame: number;
}> = ({ data, globalTurnFrame }) => {
  const frame = useCurrentFrame();

  // Phase timings within the call
  const nameEnd = 18;
  const argsEnd = 50;
  const executeEnd = 65;
  const resultEnd = 95;

  // Card entrance
  const cardProgress = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Tool name typing
  const nameChars = Math.min(
    data.name.length,
    Math.floor(Math.max(0, frame - 4) * 3)
  );

  // Args typing
  const argsChars = Math.min(
    data.args.length,
    Math.floor(Math.max(0, frame - nameEnd) * 2.5)
  );

  // Executing pulse
  const isExecuting = frame >= argsEnd && frame < executeEnd;
  const execPulse = isExecuting
    ? interpolate(Math.sin((frame - argsEnd) * 0.4), [-1, 1], [0.4, 1])
    : 0;

  // Result typing
  const resultChars = Math.min(
    data.result.length,
    Math.floor(Math.max(0, frame - executeEnd) * 2)
  );

  // Card exit
  const exitOpacity = interpolate(frame, [resultEnd, FRAMES_PER_CALL], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity: cardProgress * exitOpacity,
        transform: `translateY(${(1 - cardProgress) * 20}px)`,
      }}
    >
      {/* Turn counter */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 13,
          color: C.dim,
          marginBottom: 8,
          letterSpacing: "0.06em",
        }}
      >
        TURN {data.turn}/5 · WORK SLOT{" "}
        <span style={{ color: C.orange }}>●</span>
      </div>

      {/* Tool call card */}
      <div
        style={{
          background: C.bgLighter,
          border: `1px solid ${isExecuting ? C.orange : C.border}`,
          borderLeft: `3px solid ${C.orange}`,
          padding: "20px 24px",
          boxShadow: isExecuting
            ? `0 0 24px rgba(255,112,0,${execPulse * 0.15})`
            : `0 0 8px rgba(255,112,0,0.04)`,
          maxWidth: 800,
        }}
      >
        {/* Function name */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 22,
            fontWeight: 600,
            color: C.orange,
            marginBottom: 12,
            textShadow: "0 0 20px rgba(255,112,0,0.2)",
          }}
        >
          {data.name.slice(0, nameChars)}
          {nameChars < data.name.length && <Cursor blink={false} />}
        </div>

        {/* Arguments */}
        {frame >= nameEnd && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 14,
              color: C.muted,
              marginBottom: 12,
              lineHeight: 1.6,
              opacity: interpolate(frame - nameEnd, [0, 6], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {data.args.slice(0, argsChars)}
          </div>
        )}

        {/* Executing indicator */}
        {isExecuting && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              color: C.orange,
              opacity: execPulse,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            executing...
          </div>
        )}

        {/* Result */}
        {frame >= executeEnd && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 14,
              color: data.resultColor ?? C.text,
              marginTop: 8,
              opacity: interpolate(frame - executeEnd, [0, 6], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            {data.result.slice(0, resultChars)}
          </div>
        )}
      </div>
    </div>
  );
};

export const ToolCallsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Work slot progress bar
  const currentTurn = Math.min(5, Math.floor(frame / FRAMES_PER_CALL) + 1);
  const turnProgress = (frame % FRAMES_PER_CALL) / FRAMES_PER_CALL;

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
        <StatusLabel text="executing" color={C.orange} bg={C.orangeDim} />
        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.dim }}>
          workday in progress
        </span>

        {/* Work slot indicators */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((slot) => {
            const isUsed = slot < currentTurn;
            const isActive = slot === currentTurn && frame < 510;
            return (
              <div
                key={slot}
                style={{
                  width: 24,
                  height: 6,
                  background: isUsed
                    ? C.orange
                    : isActive
                      ? `linear-gradient(90deg, ${C.orange} ${turnProgress * 100}%, ${C.border} ${turnProgress * 100}%)`
                      : C.border,
                  opacity: isUsed || isActive ? 1 : 0.3,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Completed action trail (left sidebar) */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 48,
          width: 220,
          opacity: fadeIn,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10,
            color: C.dim,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 12,
            opacity: 0.6,
          }}
        >
          action log
        </div>
        {TOOL_CALLS.map((tc, i) => {
          const callDone = (i + 1) * FRAMES_PER_CALL;
          if (frame < callDone) return null;
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                color: C.dim,
                opacity: interpolate(
                  frame - callDone,
                  [0, 10],
                  [0, 0.5],
                  { extrapolateRight: "clamp" }
                ),
                marginBottom: 8,
                borderLeft: `2px solid ${C.border}`,
                paddingLeft: 8,
              }}
            >
              <span style={{ color: C.muted }}>{tc.name}</span>
              <br />
              <span style={{ color: tc.resultColor ?? C.dim, fontSize: 10 }}>
                done
              </span>
            </div>
          );
        })}
      </div>

      {/* Active tool call card — centered */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 320,
          right: 120,
          transform: "translateY(-50%)",
          opacity: fadeIn,
        }}
      >
        {TOOL_CALLS.map((tc, i) => {
          const callStart = i * FRAMES_PER_CALL;
          if (frame < callStart) return null;

          return (
            <Sequence
              key={i}
              from={callStart}
              durationInFrames={FRAMES_PER_CALL}
              layout="none"
              premountFor={10}
            >
              <SingleToolCall data={tc} globalTurnFrame={frame} />
            </Sequence>
          );
        })}
      </div>

      {/* Fade out */}
      <AbsoluteFill
        style={{
          backgroundColor: C.bg,
          opacity: interpolate(frame, [495, 510], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Vignette intensity={0.4} />
    </AbsoluteFill>
  );
};
