import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { BlueprintBg } from '../components/BlueprintBg';
import { C, FONT } from '../theme';

const STACK = [
  'Fastify', 'TypeScript', 'Mistral Chat Completions',
  'React', 'PostgreSQL', 'Custom Agent Loop',
];

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const builtEnter = spring({
    frame, fps, delay: 5,
    config: { damping: 200 },
  });

  const logoEnter = spring({
    frame, fps, delay: fps * 2,
    config: { damping: 12, stiffness: 100 },
  });

  const stackOpacity = interpolate(frame, [fps * 3.5, fps * 4.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const mistralOpacity = interpolate(frame, [fps * 5, fps * 6], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Subtle pulsing glow on the logo
  const glowRadius = interpolate(
    frame % (fps * 2), [0, fps], [20, 40],
    { extrapolateRight: 'clamp' },
  );
  const glowOpacity = interpolate(
    frame % (fps * 2), [0, fps, fps * 2], [0.08, 0.15, 0.08],
    { extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill>
      <BlueprintBg />
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Built solo badge */}
        <div style={{
          fontFamily: FONT.mono, fontSize: 18, fontWeight: 600,
          color: C.secondary, letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          opacity: builtEnter,
          transform: `translateY(${(1 - builtEnter) * 12}px)`,
          marginBottom: 24,
        }}>
          Built Solo &middot; 48 Hours
        </div>

        {/* BOTIQUE logo with glow */}
        <div style={{
          position: 'relative',
          fontFamily: FONT.pixel, fontSize: 100, fontWeight: 700,
          color: C.orange,
          letterSpacing: '0.06em',
          transform: `scale(${logoEnter})`,
          opacity: logoEnter,
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            filter: `blur(${glowRadius}px)`,
            opacity: glowOpacity * logoEnter,
            background: C.orange,
            borderRadius: '50%',
            zIndex: -1,
          }} />
          BOTIQUE
        </div>

        {/* Orange line */}
        <div style={{
          width: interpolate(frame, [fps * 2, fps * 2.5], [0, 200], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
          height: 3, background: C.orange, marginTop: 20, borderRadius: 2,
        }} />

        {/* Tagline */}
        <div style={{
          fontFamily: FONT.display, fontSize: 20, fontWeight: 500,
          color: C.ink, marginTop: 28, textAlign: 'center',
          opacity: stackOpacity,
          letterSpacing: '-0.01em', lineHeight: 1.5,
        }}>
          Autonomous e-commerce benchmark for language models
        </div>

        {/* Stack pills */}
        <div style={{
          display: 'flex', flexWrap: 'wrap' as const, gap: 8,
          justifyContent: 'center', marginTop: 28, maxWidth: 700,
          opacity: stackOpacity,
        }}>
          {STACK.map((item) => (
            <div key={item} style={{
              fontFamily: FONT.mono, fontSize: 11, fontWeight: 500,
              color: C.secondary,
              background: C.warm50,
              border: `1px solid ${C.rule}`,
              padding: '4px 12px', borderRadius: 2,
            }}>
              {item}
            </div>
          ))}
        </div>

        {/* Hackathon badge */}
        <div style={{
          fontFamily: FONT.pixel, fontSize: 16, fontWeight: 400,
          color: C.violet, marginTop: 40,
          opacity: mistralOpacity,
          letterSpacing: '0.04em',
        }}>
          MISTRAL WORLDWIDE HACKATHON
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
