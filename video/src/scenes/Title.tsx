import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { BlueprintBg } from '../components/BlueprintBg';
import { C, FONT } from '../theme';

export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame, fps, delay: 8,
    config: { damping: 12, stiffness: 100 },
  });

  const taglineY = spring({
    frame, fps, delay: 25,
    config: { damping: 200 },
  });

  const subOpacity = interpolate(frame, [fps * 2.5, fps * 3.2], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const lineWidth = interpolate(frame, [18, 40], [0, 320], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BlueprintBg fadeIn />
      <AbsoluteFill
        style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* BOTIQUE logo */}
        <div style={{
          fontFamily: FONT.pixel, fontSize: 110, fontWeight: 700,
          color: C.orange, letterSpacing: '0.06em',
          transform: `scale(${logoScale})`, opacity: logoScale,
        }}>
          BOTIQUE
        </div>

        {/* Orange accent line */}
        <div style={{
          width: lineWidth, height: 3,
          background: C.orange, marginTop: 16, borderRadius: 2,
        }} />

        {/* Tagline */}
        <div style={{
          fontFamily: FONT.display, fontSize: 30, fontWeight: 500,
          color: C.ink, marginTop: 28, letterSpacing: '-0.01em',
          textAlign: 'center', lineHeight: 1.4,
          opacity: taglineY,
          transform: `translateY(${(1 - taglineY) * 16}px)`,
        }}>
          Autonomous AI agents running competing shops
          <br />
          in a simulated marketplace.
        </div>

        {/* Hackathon subtitle */}
        <div style={{
          fontFamily: FONT.mono, fontSize: 14, fontWeight: 500,
          color: C.muted, marginTop: 24,
          opacity: subOpacity,
          letterSpacing: '0.08em', textTransform: 'uppercase' as const,
        }}>
          Mistral Worldwide Hackathon &middot; Built Solo &middot; 48 Hours
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
