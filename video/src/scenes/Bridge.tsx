import React from 'react';
import {
  AbsoluteFill, interpolate, spring,
  useCurrentFrame, useVideoConfig,
} from 'remotion';
import { C, FONT } from '../theme';

/**
 * Bridge scene: transitions from the light showcase world
 * into the dark agent-POV video. ~4 seconds.
 */
export const Bridge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background darkens from cream to agent dark
  const darkProgress = interpolate(frame, [fps * 1.5, fps * 3.5], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const bgColor = darkProgress < 0.5
    ? C.cream
    : `rgb(${Math.round(250 - darkProgress * 224)}, ${Math.round(250 - darkProgress * 225)}, ${Math.round(246 - darkProgress * 222)})`;

  // Actually interpolate RGB properly: cream #FAFAF6 → dark #1A1918
  const r = Math.round(interpolate(darkProgress, [0, 1], [250, 26]));
  const g = Math.round(interpolate(darkProgress, [0, 1], [250, 25]));
  const b = Math.round(interpolate(darkProgress, [0, 1], [246, 24]));

  // Text enters
  const textEnter = spring({ frame, fps, delay: 8, config: { damping: 20, stiffness: 120 } });

  // Text color transitions from ink to light
  const textR = Math.round(interpolate(darkProgress, [0, 1], [45, 232]));
  const textG = Math.round(interpolate(darkProgress, [0, 1], [43, 228]));
  const textB = Math.round(interpolate(darkProgress, [0, 1], [42, 222]));

  // Cursor blink (appears after darkening)
  const cursorOn = frame % 20 < 12;
  const cursorOpacity = interpolate(frame, [fps * 2.5, fps * 3], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Boot text peeks in
  const bootOpacity = interpolate(frame, [fps * 3, fps * 3.5], [0, 0.7], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Final fade to black
  const fadeToBlack = interpolate(frame, [fps * 3.5, fps * 4], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${r},${g},${b})` }}>
      <AbsoluteFill style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Teaser text */}
        <div style={{
          fontFamily: FONT.display, fontSize: 36, fontWeight: 600,
          color: `rgb(${textR},${textG},${textB})`,
          opacity: textEnter * (1 - fadeToBlack),
          transform: `translateY(${(1 - textEnter) * 20}px)`,
          textAlign: 'center', letterSpacing: '-0.01em',
        }}>
          But what does the agent see?
        </div>

        {/* Terminal cursor + boot line peek */}
        <div style={{
          marginTop: 40,
          fontFamily: FONT.mono, fontSize: 16,
          color: C.orange,
          opacity: cursorOpacity * (1 - fadeToBlack),
          letterSpacing: '0.04em',
        }}>
          <span style={{ opacity: bootOpacity }}>
            {'> agent_runtime v0.3.1'}
          </span>
          <span style={{
            display: 'inline-block', width: 10, height: 20,
            backgroundColor: C.orange,
            marginLeft: 4, verticalAlign: 'middle',
            opacity: cursorOn ? 1 : 0,
          }} />
        </div>
      </AbsoluteFill>

      {/* Fade to black overlay */}
      <AbsoluteFill style={{
        backgroundColor: '#1A1918',
        opacity: fadeToBlack,
      }} />
    </AbsoluteFill>
  );
};
