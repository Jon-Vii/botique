import React from 'react';
import {
  AbsoluteFill, interpolate, spring, Sequence,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { BlueprintBg } from '../components/BlueprintBg';
import { TechCard } from '../components/TechCard';
import { C, FONT } from '../theme';

const BRIEFING_STATS = [
  { label: 'Balance', value: '$247.50', color: C.orange },
  { label: 'Active Listings', value: '8', color: C.teal },
  { label: 'New Orders', value: '3', color: C.emerald },
  { label: 'Review Avg', value: '4.2 \u2605', color: C.amber },
];

const TOOL_CALLS = [
  {
    name: 'create_draft_listing',
    args: '{ title: "Mushroom Planter", style: "cottagecore", price: 24.99 }',
    color: C.teal,
  },
  {
    name: 'update_listing',
    args: '{ listing_id: 12, price: 19.99, tags: ["trending", "sale"] }',
    color: C.orange,
  },
  {
    name: 'queue_production',
    args: '{ listing_id: 12, mode: "stocked", quantity: 10 }',
    color: C.violet,
  },
  {
    name: 'update_scratchpad',
    args: '{ content: "Cottagecore trending \u2014 shift catalog focus" }',
    color: C.amber,
  },
];

const ToolCallCard: React.FC<{
  call: typeof TOOL_CALLS[0]; delay: number;
}> = ({ call, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, delay, config: { damping: 20, stiffness: 200 } });

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      padding: '18px 24px',
      background: C.white,
      border: `1px solid ${C.rule}`,
      borderLeft: `3px solid ${call.color}`,
      borderRadius: 3,
      opacity: enter,
      transform: `translateX(${(1 - enter) * 40}px)`,
    }}>
      <div style={{
        fontFamily: FONT.mono, fontSize: 16, fontWeight: 600,
        color: call.color, whiteSpace: 'nowrap' as const,
      }}>
        {call.name}()
      </div>
      <div style={{
        fontFamily: FONT.mono, fontSize: 14, color: C.secondary,
        lineHeight: 1.5,
      }}>
        {call.args}
      </div>
    </div>
  );
};

export const AgentDay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headEnter = spring({ frame, fps, delay: 0, config: { damping: 200 } });

  const sectionLabel = interpolate(frame, [fps * 3, fps * 3.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BlueprintBg />
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'row',
        padding: '80px 100px', gap: 60,
      }}>
        {/* Left column — briefing */}
        <div style={{ flex: '0 0 520px', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            fontFamily: FONT.display, fontSize: 48, fontWeight: 700,
            color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.2,
            opacity: headEnter, transform: `translateY(${(1 - headEnter) * 16}px)`,
            marginBottom: 8,
          }}>
            A Day in the Life
          </div>
          <div style={{
            fontFamily: FONT.display, fontSize: 16, color: C.secondary,
            marginBottom: 32, opacity: headEnter,
          }}>
            Every simulated day, each agent receives a morning briefing, then gets bounded work slots.
          </div>

          {/* Briefing card */}
          <Sequence from={fps * 1} layout="none">
            <TechCard delay={0} style={{ padding: '24px 28px' }}>
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
                color: C.muted, textTransform: 'uppercase' as const,
                letterSpacing: '0.1em', marginBottom: 16,
              }}>
                Morning Briefing
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
              }}>
                {BRIEFING_STATS.map((stat, i) => {
                  const statEnter = spring({
                    frame: frame - fps * 1,
                    fps, delay: i * 6,
                    config: { damping: 200 },
                  });
                  return (
                    <div key={stat.label} style={{ opacity: Math.max(0, statEnter) }}>
                      <div style={{
                        fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
                        color: C.muted, textTransform: 'uppercase' as const,
                        letterSpacing: '0.08em', marginBottom: 4,
                      }}>
                        {stat.label}
                      </div>
                      <div style={{
                        fontFamily: FONT.mono, fontSize: 26, fontWeight: 700,
                        color: stat.color,
                      }}>
                        {stat.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TechCard>
          </Sequence>
        </div>

        {/* Right column — tool calls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
            color: C.orange, textTransform: 'uppercase' as const,
            letterSpacing: '0.12em', marginBottom: 16,
            opacity: sectionLabel,
          }}>
            Agent Tool Calls
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TOOL_CALLS.map((call, i) => (
              <Sequence key={call.name} from={fps * 3.5 + i * 15} layout="none">
                <ToolCallCard call={call} delay={0} />
              </Sequence>
            ))}
          </div>

          <Sequence from={fps * 10} layout="none">
            <div style={{
              fontFamily: FONT.mono, fontSize: 12, color: C.muted,
              marginTop: 24, lineHeight: 1.6,
              opacity: interpolate(frame - fps * 10, [0, 15], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              }),
            }}>
              Explicit scratchpad/journal/reminder memory.
              <br />
              No vector DB. No hidden state.
            </div>
          </Sequence>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
