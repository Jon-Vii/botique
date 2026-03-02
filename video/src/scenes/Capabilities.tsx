import React from 'react';
import {
  AbsoluteFill, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { BlueprintBg } from '../components/BlueprintBg';
import { C, FONT } from '../theme';

const CAPS = [
  {
    label: 'Operational',
    desc: 'Reprioritize, publish, price, produce, and respond to feedback',
    color: C.orange,
  },
  {
    label: 'Strategic',
    desc: 'Form a direction, test ideas, and shift based on evidence',
    color: C.teal,
  },
  {
    label: 'Memory',
    desc: 'Preserve useful context and plans across days',
    color: C.amber,
  },
  {
    label: 'Adaptive',
    desc: 'Expand into adjacent opportunities or pivot when current lane weakens',
    color: C.violet,
  },
  {
    label: 'Resource Governance',
    desc: 'Manage cash, capacity, inventory, backlog, and risk',
    color: C.emerald,
  },
];

export const Capabilities: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headEnter = spring({ frame, fps, delay: 0, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <BlueprintBg />
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 140px',
      }}>
        {/* Header */}
        <div style={{
          fontFamily: FONT.display, fontSize: 40, fontWeight: 700,
          color: C.ink, textAlign: 'center', letterSpacing: '-0.02em',
          opacity: headEnter, transform: `translateY(${(1 - headEnter) * 16}px)`,
          marginBottom: 8,
        }}>
          Not Just Tool Use.{' '}
          <span style={{ color: C.orange }}>Autonomous Organization.</span>
        </div>
        <div style={{
          fontFamily: FONT.display, fontSize: 17, color: C.secondary,
          textAlign: 'center', marginBottom: 52, opacity: headEnter,
        }}>
          Botique evaluates five dimensions of autonomous capability
        </div>

        {/* Capability cards */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          width: '100%', maxWidth: 900,
        }}>
          {CAPS.map((cap, i) => {
            const enter = spring({
              frame, fps, delay: fps * 1 + i * 10,
              config: { damping: 20, stiffness: 200 },
            });
            return (
              <div key={cap.label} style={{
                display: 'flex', alignItems: 'center', gap: 20,
                padding: '18px 28px',
                background: C.white,
                border: `1px solid ${C.rule}`,
                borderLeft: `4px solid ${cap.color}`,
                borderRadius: 3,
                opacity: enter,
                transform: `translateX(${(1 - enter) * 60}px)`,
                boxShadow: '0 1px 3px rgba(45,43,42,0.04)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 18,
                  background: cap.color + '15',
                  border: `1.5px solid ${cap.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{
                    fontFamily: FONT.mono, fontSize: 14, fontWeight: 700,
                    color: cap.color,
                  }}>
                    {i + 1}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: FONT.display, fontSize: 18, fontWeight: 700,
                    color: C.ink, marginBottom: 2,
                  }}>
                    {cap.label}
                  </div>
                  <div style={{
                    fontFamily: FONT.display, fontSize: 14, color: C.secondary,
                    lineHeight: 1.4,
                  }}>
                    {cap.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
