import React from 'react';
import {
  AbsoluteFill, interpolate, spring, Sequence,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { BlueprintBg } from '../components/BlueprintBg';
import { TechCard } from '../components/TechCard';
import { C, FONT } from '../theme';

const MODELS = [
  { name: 'Mistral Large', id: 'mistral-large-latest' },
  { name: 'Mistral Medium', id: 'mistral-medium-latest' },
  { name: 'Mistral Small', id: 'mistral-small-latest' },
  { name: 'Magistral Medium', id: 'magistral-medium-latest' },
  { name: 'Magistral Small', id: 'magistral-small-latest' },
];

const MODEL_COLORS = [C.orange, C.teal, C.violet, C.emerald, C.amber];

export const Tournament: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headEnter = spring({ frame, fps, delay: 0, config: { damping: 200 } });

  const configEnter = spring({
    frame, fps, delay: fps * 6,
    config: { damping: 200 },
  });

  const footerOpacity = interpolate(frame, [fps * 8, fps * 9], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BlueprintBg />
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 100px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6,
          opacity: headEnter,
        }}>
          <div style={{
            fontFamily: FONT.pixel, fontSize: 13, fontWeight: 400,
            color: C.violet, letterSpacing: '0.08em',
          }}>
            ARENA MODE
          </div>
        </div>
        <div style={{
          fontFamily: FONT.display, fontSize: 44, fontWeight: 700,
          color: C.ink, textAlign: 'center', letterSpacing: '-0.02em',
          opacity: headEnter, transform: `translateY(${(1 - headEnter) * 16}px)`,
          marginBottom: 8,
        }}>
          5 Mistral Models. <span style={{ color: C.violet }}>Head to Head.</span>
        </div>
        <div style={{
          fontFamily: FONT.display, fontSize: 17, color: C.secondary,
          textAlign: 'center', marginBottom: 48, opacity: headEnter,
        }}>
          Same market. Same starting conditions. Who runs the best shop?
        </div>

        {/* Model roster */}
        <div style={{
          display: 'flex', gap: 16, marginBottom: 48,
        }}>
          {MODELS.map((model, i) => {
            const cardEnter = spring({
              frame, fps, delay: fps * 1.8 + i * 10,
              config: { damping: 18, stiffness: 180 },
            });
            const color = MODEL_COLORS[i];
            return (
              <div key={model.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '24px 28px',
                background: C.white,
                border: `1px solid ${C.rule}`,
                borderTop: `3px solid ${color}`,
                borderRadius: 3,
                opacity: cardEnter,
                transform: `translateY(${(1 - cardEnter) * 24}px) scale(${0.95 + cardEnter * 0.05})`,
                minWidth: 180,
                boxShadow: '0 1px 3px rgba(45,43,42,0.05)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 20,
                  background: color + '18',
                  border: `2px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <div style={{
                    fontFamily: FONT.mono, fontSize: 14, fontWeight: 700,
                    color: color,
                  }}>
                    {i + 1}
                  </div>
                </div>
                <div style={{
                  fontFamily: FONT.display, fontSize: 16, fontWeight: 700,
                  color: C.ink, textAlign: 'center', marginBottom: 4,
                }}>
                  {model.name}
                </div>
                <div style={{
                  fontFamily: FONT.mono, fontSize: 10, color: C.muted,
                }}>
                  {model.id}
                </div>
              </div>
            );
          })}
        </div>

        {/* Config card */}
        <Sequence from={fps * 6} layout="none">
          <TechCard delay={0} accentColor={C.violet} style={{
            padding: '20px 36px',
            display: 'flex', gap: 40, alignItems: 'center',
          }}>
            {[
              { label: 'Days / Round', value: '5' },
              { label: 'Rounds', value: '2' },
              { label: 'Turns / Day', value: '5' },
              { label: 'Scenario', value: 'operate' },
            ].map((cfg) => (
              <div key={cfg.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
                  color: C.muted, textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  {cfg.label}
                </div>
                <div style={{
                  fontFamily: FONT.mono, fontSize: 22, fontWeight: 700, color: C.violet,
                }}>
                  {cfg.value}
                </div>
              </div>
            ))}
          </TechCard>
        </Sequence>

        {/* Footer */}
        <div style={{
          fontFamily: FONT.mono, fontSize: 13, color: C.muted,
          marginTop: 32, textAlign: 'center', opacity: footerOpacity,
        }}>
          Rotating shop assignments &middot; Shared world state &middot; Reset between rounds
          <br />
          Primary score: <span style={{ color: C.orange, fontWeight: 600 }}>available cash</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
