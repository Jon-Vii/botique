import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { C, FONT } from "../theme";
import { GridBackground, Vignette, Scanlines, StatusLabel } from "../lib";

interface AgentData {
  shopName: string;
  model: string;
  modelColor: string;
  balance: number;
  orders: number;
  rank: number;
  isFollowed?: boolean;
  lastAction: string;
}

const AGENTS: AgentData[] = [
  {
    shopName: "Mushroom & Moon",
    model: "mistral-small",
    modelColor: C.teal,
    balance: 623.4,
    orders: 41,
    rank: 4,
    lastAction: "update_listing → price: $16.99",
  },
  {
    shopName: "Terra & Tide Pottery",
    model: "mistral-medium",
    modelColor: C.orange,
    balance: 929.5,
    orders: 58,
    rank: 2,
    isFollowed: true,
    lastAction: "get_shop_dashboard → 3 active, 1 draft",
  },
  {
    shopName: "Pixel Planters",
    model: "mistral-medium",
    modelColor: C.orange,
    balance: 1047.2,
    orders: 72,
    rank: 1,
    lastAction: "queue_production → 12 units queued",
  },
  {
    shopName: "The Print Garden",
    model: "mistral-small",
    modelColor: C.teal,
    balance: 445.8,
    orders: 29,
    rank: 5,
    lastAction: "create_draft_listing → desk organizer",
  },
  {
    shopName: "Craftcore Studio",
    model: "mistral-medium",
    modelColor: C.orange,
    balance: 891.6,
    orders: 64,
    rank: 3,
    lastAction: "update_listing → added cottagecore tags",
  },
];

const AgentPanel: React.FC<{
  agent: AgentData;
  index: number;
  isExpanded: boolean;
  expandProgress: number;
}> = ({ agent, index, isExpanded, expandProgress }) => {
  const frame = useCurrentFrame();

  const panelDelay = agent.isFollowed ? 0 : 60 + index * 15;
  const panelOpacity = agent.isFollowed
    ? 1
    : interpolate(frame, [panelDelay, panelDelay + 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  // Balance counter tick (after all panels visible)
  const counterStart = 180;
  const balanceProgress =
    frame >= counterStart
      ? interpolate(frame - counterStart, [0, 60], [0, 1], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.quad),
        })
      : 0;

  const displayBalance = (agent.balance * balanceProgress).toFixed(2);

  return (
    <div
      style={{
        opacity: panelOpacity,
        background: agent.isFollowed ? C.bgLighter : C.bg,
        border: `1px solid ${agent.isFollowed ? C.borderOrange : C.border}`,
        borderLeft: agent.isFollowed
          ? `3px solid ${C.orange}`
          : `3px solid ${agent.modelColor}40`,
        padding: "14px 18px",
        boxShadow: agent.isFollowed
          ? "0 0 24px rgba(255,112,0,0.1)"
          : "none",
        position: "relative",
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 14,
          fontFamily: FONT.mono,
          fontSize: 11,
          color: agent.rank === 1 ? C.orange : C.dim,
          fontWeight: agent.rank === 1 ? 700 : 400,
        }}
      >
        #{agent.rank}
      </div>

      {/* Shop name */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 16,
          fontWeight: 600,
          color: agent.isFollowed ? C.orange : C.text,
          marginBottom: 4,
          textShadow: agent.isFollowed
            ? "0 0 16px rgba(255,112,0,0.2)"
            : "none",
        }}
      >
        {agent.shopName}
        {agent.isFollowed && (
          <span
            style={{
              fontSize: 10,
              color: C.dim,
              fontWeight: 400,
              marginLeft: 8,
            }}
          >
            ← you followed this one
          </span>
        )}
      </div>

      {/* Model tag */}
      <div style={{ marginBottom: 10 }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: agent.modelColor,
            background: `${agent.modelColor}18`,
            padding: "2px 6px",
            letterSpacing: "0.04em",
          }}
        >
          {agent.model}
        </span>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 24,
          fontFamily: FONT.mono,
          fontSize: 13,
        }}
      >
        <div>
          <span style={{ color: C.dim }}>balance </span>
          <span
            style={{
              color: C.text,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ${displayBalance}
          </span>
        </div>
        <div>
          <span style={{ color: C.dim }}>orders </span>
          <span style={{ color: C.text }}>
            {Math.round(agent.orders * balanceProgress)}
          </span>
        </div>
      </div>

      {/* Last action */}
      {frame >= panelDelay + 30 && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: C.dim,
            marginTop: 8,
            opacity: interpolate(
              frame - (panelDelay + 30),
              [0, 12],
              [0, 0.7],
              { extrapolateRight: "clamp" }
            ),
          }}
        >
          last: {agent.lastAction}
        </div>
      )}
    </div>
  );
};

export const RevealScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // The "zoom out" feeling: scale the whole content
  const zoomScale = interpolate(frame, [0, 60], [1.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Leaderboard appearance
  const leaderboardOpacity = interpolate(frame, [260, 290], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "simultaneously" label
  const simLabelOpacity = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <GridBackground opacity={0.015} />
      <Scanlines />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoomScale})`,
          transformOrigin: "center center",
          opacity: fadeIn,
        }}
      >
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
          }}
        >
          <StatusLabel text="tournament" color={C.violet} bg="rgba(139,92,246,0.15)" />
          <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.dim }}>
            arena mode · 5 entrants · day 14 complete
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: FONT.mono,
              fontSize: 12,
              color: C.orange,
              opacity: simLabelOpacity,
            }}
          >
            all running simultaneously
          </span>
        </div>

        {/* Agent panels grid */}
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 60,
            right: 60,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
          }}
        >
          {AGENTS.slice(0, 3).map((agent, i) => (
            <AgentPanel
              key={i}
              agent={agent}
              index={i}
              isExpanded={false}
              expandProgress={0}
            />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            top: 310,
            left: 60,
            right: 60,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            paddingLeft: "calc(50% - 500px)",
            paddingRight: "calc(50% - 500px)",
          }}
        >
          {AGENTS.slice(3).map((agent, i) => (
            <AgentPanel
              key={i + 3}
              agent={agent}
              index={i + 3}
              isExpanded={false}
              expandProgress={0}
            />
          ))}
        </div>

        {/* Leaderboard bar at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 60,
            right: 60,
            opacity: leaderboardOpacity,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              color: C.dim,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            standings · ending balance after 14 days
          </div>

          <div
            style={{
              background: C.bgLighter,
              border: `1px solid ${C.border}`,
              padding: "12px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {[...AGENTS]
              .sort((a, b) => a.rank - b.rank)
              .map((agent, i) => {
                const barWidth = (agent.balance / 1100) * 100;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      padding: "0 12px",
                      borderRight:
                        i < 4 ? `1px solid ${C.border}` : "none",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 11,
                        color: agent.isFollowed ? C.orange : C.dim,
                        marginBottom: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {agent.shopName}
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: C.border,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${barWidth}%`,
                          background: agent.isFollowed
                            ? C.orange
                            : agent.modelColor,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 12,
                        fontWeight: 600,
                        color: agent.isFollowed ? C.orange : C.text,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ${agent.balance.toFixed(2)}
                    </div>
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
          opacity: interpolate(frame, [375, 390], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <Vignette intensity={0.4} />
    </AbsoluteFill>
  );
};
