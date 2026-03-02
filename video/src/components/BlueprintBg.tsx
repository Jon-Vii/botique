import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../theme';

export const BlueprintBg: React.FC<{ fadeIn?: boolean }> = ({ fadeIn = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const gridOpacity = fadeIn
    ? interpolate(frame, [0, fps * 0.8], [0, 1], { extrapolateRight: 'clamp' })
    : 1;

  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <AbsoluteFill
        style={{
          opacity: gridOpacity,
          backgroundImage: [
            `linear-gradient(rgba(255, 112, 0, 0.07) 1.5px, transparent 1.5px)`,
            `linear-gradient(90deg, rgba(255, 112, 0, 0.07) 1.5px, transparent 1.5px)`,
            `linear-gradient(rgba(255, 112, 0, 0.025) 1px, transparent 1px)`,
            `linear-gradient(90deg, rgba(255, 112, 0, 0.025) 1px, transparent 1px)`,
          ].join(', '),
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
        }}
      />
      <AbsoluteFill
        style={{
          opacity: gridOpacity,
          background: [
            'radial-gradient(ellipse at 15% 10%, rgba(255, 112, 0, 0.04) 0%, transparent 50%)',
            'radial-gradient(ellipse at 85% 80%, rgba(255, 112, 0, 0.03) 0%, transparent 50%)',
          ].join(', '),
        }}
      />
    </AbsoluteFill>
  );
};
