import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import { BlueprintBg } from '../components/BlueprintBg';
import { C, FONT } from '../theme';

const PIPELINE = [
  { label: 'Taxonomy\nTraffic', value: '500', unit: 'sessions/day', color: C.orange },
  { label: 'Discoverability', value: '127', unit: 'views', color: C.teal },
  { label: 'Conversion', value: '8', unit: 'orders', color: C.emerald },
  { label: 'Revenue', value: '$189', unit: 'earned', color: C.amber },
];

const FACTORS = [
  'Listing quality', 'Shop reputation', 'Price competitiveness',
  'Trend alignment', 'Production capacity', 'Delayed reviews',
];

const AnimatedNumber: React.FC<{
  target: number; prefix?: string; delay: number; color: string;
}> = ({ target, prefix = '', delay, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = interpolate(frame, [delay, delay + fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const current = Math.round(target * progress);

  return (
    <span style={{ fontFamily: FONT.mono, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{current}
    </span>
  );
};

export const SimEngine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headEnter = spring({ frame, fps, delay: 0, config: { damping: 200 } });

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
          fontFamily: FONT.display, fontSize: 44, fontWeight: 700,
          color: C.ink, textAlign: 'center', letterSpacing: '-0.02em',
          opacity: headEnter, transform: `translateY(${(1 - headEnter) * 16}px)`,
          marginBottom: 8,
        }}>
          The World Decides <span style={{ color: C.orange }}>What Happens</span>
        </div>
        <div style={{
          fontFamily: FONT.display, fontSize: 17, color: C.secondary,
          textAlign: 'center', marginBottom: 56, opacity: headEnter,
        }}>
          Formula-driven demand. No LLM in sales outcomes.
        </div>

        {/* Pipeline */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          marginBottom: 56,
        }}>
          {PIPELINE.map((stage, i) => {
            const stageEnter = spring({
              frame, fps, delay: fps * 1.5 + i * 12,
              config: { damping: 20, stiffness: 200 },
            });
            return (
              <React.Fragment key={stage.label}>
                {i > 0 && (
                  <div style={{
                    width: 48, height: 3, background: C.rule,
                    opacity: stageEnter,
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', right: -4, top: -5,
                      width: 0, height: 0,
                      borderLeft: `8px solid ${C.muted}`,
                      borderTop: '6px solid transparent',
                      borderBottom: '6px solid transparent',
                      opacity: stageEnter,
                    }} />
                  </div>
                )}
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '28px 36px',
                  background: C.white,
                  border: `1px solid ${C.rule}`,
                  borderTop: `3px solid ${stage.color}`,
                  borderRadius: 3,
                  opacity: stageEnter,
                  transform: `translateY(${(1 - stageEnter) * 20}px)`,
                  minWidth: 160,
                  boxShadow: '0 1px 3px rgba(45,43,42,0.05)',
                }}>
                  <div style={{
                    fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
                    color: C.muted, textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em', textAlign: 'center',
                    whiteSpace: 'pre-line' as const, marginBottom: 12,
                  }}>
                    {stage.label}
                  </div>
                  <div style={{ fontSize: 36 }}>
                    <AnimatedNumber
                      target={parseInt(stage.value.replace(/\D/g, ''))}
                      prefix={stage.value.startsWith('$') ? '$' : ''}
                      delay={fps * 1.5 + i * 12 + 8}
                      color={stage.color}
                    />
                  </div>
                  <div style={{
                    fontFamily: FONT.mono, fontSize: 11, color: C.muted,
                    marginTop: 4,
                  }}>
                    {stage.unit}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Factor pills */}
        <div style={{
          display: 'flex', flexWrap: 'wrap' as const, gap: 10,
          justifyContent: 'center', maxWidth: 900,
        }}>
          {FACTORS.map((factor, i) => {
            const pillEnter = spring({
              frame, fps, delay: fps * 5.5 + i * 5,
              config: { damping: 200 },
            });
            return (
              <div key={factor} style={{
                fontFamily: FONT.mono, fontSize: 12, fontWeight: 500,
                color: C.secondary,
                background: C.warm50, border: `1px solid ${C.rule}`,
                padding: '5px 14px', borderRadius: 2,
                opacity: pillEnter,
                transform: `translateY(${(1 - pillEnter) * 10}px)`,
              }}>
                {factor}
              </div>
            );
          })}
        </div>

        {/* 8 cohorts note */}
        <div style={{
          fontFamily: FONT.mono, fontSize: 13, color: C.muted,
          marginTop: 32, textAlign: 'center',
          opacity: interpolate(frame, [fps * 8, fps * 9], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
        }}>
          8 customer cohorts with hidden preferences &middot; Delayed reviews arrive days later
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
