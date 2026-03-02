import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../theme';

export const TechCard: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  accentColor?: string;
}> = ({ children, delay = 0, style, accentColor = C.orange }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    delay,
    config: { damping: 20, stiffness: 200 },
  });

  return (
    <div
      style={{
        position: 'relative',
        background: C.white,
        border: `1px solid ${C.rule}`,
        borderRadius: 3,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 24}px)`,
        boxShadow: '0 1px 3px rgba(45,43,42,0.05), 0 4px 12px rgba(45,43,42,0.03)',
        ...style,
      }}
    >
      {/* Top-left corner bracket */}
      <div
        style={{
          position: 'absolute', top: -1, left: -1,
          width: 12, height: 12,
          borderTop: `2.5px solid ${accentColor}`,
          borderLeft: `2.5px solid ${accentColor}`,
          zIndex: 2,
        }}
      />
      {/* Bottom-right corner bracket */}
      <div
        style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 12, height: 12,
          borderBottom: `2.5px solid ${accentColor}`,
          borderRight: `2.5px solid ${accentColor}`,
          zIndex: 2,
        }}
      />
      {children}
    </div>
  );
};
