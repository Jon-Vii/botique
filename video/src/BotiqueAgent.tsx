import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame } from "remotion";
import { staticFile } from "remotion";
import { C, SCENE, FPS } from "./theme";
import { FrameCounter } from "./lib";
import { BootScene } from "./scenes/Boot";
import { BriefingScene } from "./scenes/Briefing";
import { ReasoningScene } from "./scenes/Reasoning";
import { ToolCallsScene } from "./scenes/ToolCalls";
import { DayResolvesScene } from "./scenes/DayResolves";
import { RevealScene } from "./scenes/Reveal";
import { TitleCardScene } from "./scenes/TitleCard";

// Tool call chirp timing: each tool resolves ~65 frames into its 102-frame slot
const TOOL_FRAMES_PER_CALL = 102;
const TOOL_RESOLVE_OFFSET = 65; // when result appears

export const BotiqueAgent: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/* ═══ AUDIO LAYERS ═══ */}

      {/* Layer 1: Ambient drone — full duration, quiet bed */}
      <Audio
        src={staticFile("sfx/drone.wav")}
        startFrom={0}
        volume={0.35}
      />

      {/* Layer 2: Typing sounds — Boot scene (3s track) */}
      <Sequence from={SCENE.boot.from + 10} durationInFrames={80}>
        <Audio src={staticFile("sfx/typing-boot.wav")} volume={0.5} />
      </Sequence>

      {/* Layer 2b: Typing sounds — Briefing scene (7s track) */}
      <Sequence from={SCENE.briefing.from + 5} durationInFrames={200}>
        <Audio src={staticFile("sfx/typing-briefing.wav")} volume={0.4} />
      </Sequence>

      {/* Layer 2c: Typing sounds — Reasoning scene (6s track) */}
      <Sequence from={SCENE.reasoning.from + 5} durationInFrames={170}>
        <Audio src={staticFile("sfx/typing-reasoning.wav")} volume={0.3} />
      </Sequence>

      {/* Layer 3: Tool call chirps — one per tool resolution */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Sequence
          key={`chirp-${i}`}
          from={SCENE.toolCalls.from + i * TOOL_FRAMES_PER_CALL + TOOL_RESOLVE_OFFSET}
          durationInFrames={15}
        >
          <Audio src={staticFile("sfx/chirp.wav")} volume={0.5} />
        </Sequence>
      ))}

      {/* Layer 4: Whoosh — briefing entrance */}
      <Sequence from={SCENE.briefing.from} durationInFrames={12}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.4} />
      </Sequence>

      {/* Layer 4b: Whoosh — reasoning entrance */}
      <Sequence from={SCENE.reasoning.from} durationInFrames={12}>
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} />
      </Sequence>

      {/* Layer 5: Ticks — DayResolves settlement numbers appearing */}
      {[30, 55, 80, 105, 130, 155, 180].map((offset, i) => (
        <Sequence
          key={`tick-${i}`}
          from={SCENE.dayResolves.from + offset}
          durationInFrames={5}
        >
          <Audio src={staticFile("sfx/tick.wav")} volume={0.4} />
        </Sequence>
      ))}

      {/* Layer 6: Bass swell — Reveal zoom-out moment */}
      <Sequence from={SCENE.reveal.from} durationInFrames={120}>
        <Audio src={staticFile("sfx/swell.wav")} volume={0.6} />
      </Sequence>

      {/* Layer 7: Title tone — TitleCard entrance */}
      <Sequence from={SCENE.titleCard.from + 10} durationInFrames={180}>
        <Audio src={staticFile("sfx/title-tone.wav")} volume={0.45} />
      </Sequence>

      {/* ═══ VISUAL SCENES ═══ */}

      {/* Scene 1: Boot — "initializing agent_runtime..." */}
      <Sequence
        from={SCENE.boot.from}
        durationInFrames={SCENE.boot.duration}
        premountFor={10}
      >
        <BootScene />
      </Sequence>

      {/* Scene 2: Briefing — morning brief materializes line by line */}
      <Sequence
        from={SCENE.briefing.from}
        durationInFrames={SCENE.briefing.duration}
        premountFor={15}
      >
        <BriefingScene />
      </Sequence>

      {/* Scene 3: Reasoning — agent chain-of-thought */}
      <Sequence
        from={SCENE.reasoning.from}
        durationInFrames={SCENE.reasoning.duration}
        premountFor={15}
      >
        <ReasoningScene />
      </Sequence>

      {/* Scene 4: Tool Calls — 5 actions fire and resolve */}
      <Sequence
        from={SCENE.toolCalls.from}
        durationInFrames={SCENE.toolCalls.duration}
        premountFor={15}
      >
        <ToolCallsScene />
      </Sequence>

      {/* Scene 5: Day Resolves — settlement and scratchpad */}
      <Sequence
        from={SCENE.dayResolves.from}
        durationInFrames={SCENE.dayResolves.duration}
        premountFor={15}
      >
        <DayResolvesScene />
      </Sequence>

      {/* Scene 6: Reveal — zoom out to 5 competing agents */}
      <Sequence
        from={SCENE.reveal.from}
        durationInFrames={SCENE.reveal.duration}
        premountFor={15}
      >
        <RevealScene />
      </Sequence>

      {/* Scene 7: Title Card — BOTIQUE */}
      <Sequence
        from={SCENE.titleCard.from}
        durationInFrames={SCENE.titleCard.duration}
        premountFor={15}
      >
        <TitleCardScene />
      </Sequence>

      {/* Persistent HUD: frame counter in corner */}
      <FrameCounter />
    </AbsoluteFill>
  );
};
