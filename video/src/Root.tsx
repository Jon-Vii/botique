import React from "react";
import { Composition } from "remotion";
import { BotiqueDemo } from "./BotiqueDemo";
import { BotiqueAgent } from "./BotiqueAgent";
import { FPS, WIDTH, HEIGHT, TOTAL_FRAMES, DUR, T } from "./theme";

// Showcase (light) total: sum of DUR values minus transition overlaps
const SHOWCASE_FRAMES =
  DUR.title +
  DUR.whatIsIt +
  DUR.agentDay +
  DUR.simEngine +
  DUR.tournament +
  DUR.capabilities +
  DUR.closing +
  DUR.bridge -
  7 * T; // 7 transitions

export const Root: React.FC = () => {
  return (
    <>
      {/* Dark agent-POV narrative (70s) */}
      <Composition
        id="BotiqueAgent"
        component={BotiqueAgent}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Light product showcase */}
      <Composition
        id="BotiqueDemo"
        component={BotiqueDemo}
        durationInFrames={SHOWCASE_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
