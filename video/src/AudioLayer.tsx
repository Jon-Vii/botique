import React from 'react';
import { Audio } from '@remotion/media';
import { Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

// Scene start frames (accounting for 12-frame transition overlaps)
const SCENE_START = {
  title: 0,
  whatIsIt: 123,
  agentDay: 381,
  simEngine: 759,
  tournament: 1077,
  capabilities: 1425,
  closing: 1653,
  bridge: 1881,  // 1653 + 240 - 12
} as const;

// Slide transitions: whoosh
const SLIDE_FRAMES = [123, 381, 1077];

// Fade transitions: swell (closing→bridge gets its own deeper swell)
const FADE_FRAMES = [759, 1425, 1653];

// Key card appearance frames (first card in each scene)
const POP_FRAMES = [
  SCENE_START.whatIsIt + 60,   // first system card in WhatIsIt
  SCENE_START.agentDay + 30,   // briefing card in AgentDay
  SCENE_START.agentDay + 105,  // first tool call
  SCENE_START.simEngine + 45,  // first pipeline stage
  SCENE_START.tournament + 54, // first model card
  SCENE_START.capabilities + 30, // first capability card
];

export const AudioLayer: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <>
      {/* Background music — ambient electronic pad, looped, soft */}
      <Audio
        src={staticFile('sfx/gen/bg-music.wav')}
        volume={(f) => {
          // Fade in over 2s, sustain, fade out over last 4s
          const fadeIn = interpolate(f, [0, 2 * fps], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const fadeOut = interpolate(
            f,
            [durationInFrames - 4 * fps, durationInFrames],
            [1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return 0.2 * fadeIn * fadeOut;
        }}
        loop
      />

      {/* Title entrance tone */}
      <Sequence from={5} layout="none">
        <Audio src={staticFile('sfx/title-tone.wav')} volume={0.35} />
      </Sequence>

      {/* Slide transition whooshes */}
      {SLIDE_FRAMES.map((frame) => (
        <Sequence key={`whoosh-${frame}`} from={frame} layout="none">
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.5} />
        </Sequence>
      ))}

      {/* Fade transition swells */}
      {FADE_FRAMES.map((frame) => (
        <Sequence key={`swell-${frame}`} from={frame - 6} layout="none">
          <Audio src={staticFile('sfx/swell.wav')} volume={0.25} />
        </Sequence>
      ))}

      {/* Card appearance pops */}
      {POP_FRAMES.map((frame) => (
        <Sequence key={`pop-${frame}`} from={frame} layout="none">
          <Audio src={staticFile('sfx/gen/pop.wav')} volume={0.15} />
        </Sequence>
      ))}

      {/* Closing logo entrance — reuse title tone softer */}
      <Sequence from={SCENE_START.closing + 2 * fps} layout="none">
        <Audio src={staticFile('sfx/title-tone.wav')} volume={0.25} />
      </Sequence>

      {/* Bridge transition — deeper swell as we enter the agent world */}
      <Sequence from={SCENE_START.bridge - 6} layout="none">
        <Audio src={staticFile('sfx/swell.wav')} volume={0.4} />
      </Sequence>

      {/* Chirp-down as the bridge fades to dark */}
      <Sequence from={SCENE_START.bridge + 2 * fps} layout="none">
        <Audio src={staticFile('sfx/chirp-down.wav')} volume={0.35} />
      </Sequence>
    </>
  );
};
