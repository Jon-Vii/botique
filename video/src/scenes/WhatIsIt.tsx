import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { BlueprintBg } from '../components/BlueprintBg';
import { TechCard } from '../components/TechCard';
import { C, FONT } from '../theme';

const SYSTEMS = [
  { label: 'S1', name: 'Platform Server', desc: 'Seller-facing HTTP contract', color: C.orange },
  { label: 'S2', name: 'Simulation Engine', desc: 'Formula-driven marketplace state', color: C.teal },
  { label: 'S3', name: 'Agent Orchestrator', desc: 'LLM agents with tools + memory', color: C.violet },
  { label: 'S4', name: 'Frontend Layer', desc: 'Human observation + controls', color: C.emerald },
];

export const WhatIsIt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const headlineY = interpolate(frame, [0, 20], [20, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const subOpacity = interpolate(frame, [fps * 5, fps * 6], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <BlueprintBg />
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 120px',
      }}>
        {/* Headline */}
        <div style={{
          fontFamily: FONT.display, fontSize: 44, fontWeight: 700,
          color: C.ink, textAlign: 'center',
          letterSpacing: '-0.02em', lineHeight: 1.2,
          opacity: headlineOpacity,
          transform: `translateY(${headlineY}px)`,
          marginBottom: 60,
        }}>
          What if language models{' '}
          <span style={{ color: C.orange }}>ran their own businesses?</span>
        </div>

        {/* System cards grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 24, width: '100%', maxWidth: 1100,
        }}>
          {SYSTEMS.map((sys, i) => (
            <TechCard key={sys.label} delay={fps * 1.5 + i * 8} accentColor={sys.color} style={{ padding: '28px 32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{
                  fontFamily: FONT.mono, fontSize: 11, fontWeight: 600,
                  color: sys.color, textTransform: 'uppercase' as const,
                  letterSpacing: '0.1em',
                  background: sys.color + '15', padding: '3px 10px',
                  borderRadius: 2, border: `1px solid ${sys.color}25`,
                }}>
                  {sys.label}
                </div>
                <span style={{
                  fontFamily: FONT.display, fontSize: 20, fontWeight: 700,
                  color: C.ink,
                }}>
                  {sys.name}
                </span>
              </div>
              <div style={{
                fontFamily: FONT.display, fontSize: 15, color: C.secondary,
                lineHeight: 1.5,
              }}>
                {sys.desc}
              </div>
            </TechCard>
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          fontFamily: FONT.mono, fontSize: 13, color: C.muted,
          marginTop: 48, textAlign: 'center', opacity: subOpacity,
          letterSpacing: '0.02em',
        }}>
          Each system independently testable and replaceable. Modules communicate through explicit contracts.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
