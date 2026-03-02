import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { Title } from './scenes/Title';
import { WhatIsIt } from './scenes/WhatIsIt';
import { AgentDay } from './scenes/AgentDay';
import { SimEngine } from './scenes/SimEngine';
import { Tournament } from './scenes/Tournament';
import { Capabilities } from './scenes/Capabilities';
import { Closing } from './scenes/Closing';
import { Bridge } from './scenes/Bridge';
import { AudioLayer } from './AudioLayer';
import { DUR, T } from './theme';

export const BotiqueDemo: React.FC = () => {
  return (
    <AbsoluteFill>
    <AudioLayer />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={DUR.title}>
        <Title />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: T })}
      />

      <TransitionSeries.Sequence durationInFrames={DUR.whatIsIt}>
        <WhatIsIt />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: T })}
      />

      <TransitionSeries.Sequence durationInFrames={DUR.agentDay}>
        <AgentDay />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      <TransitionSeries.Sequence durationInFrames={DUR.simEngine}>
        <SimEngine />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: T })}
      />

      <TransitionSeries.Sequence durationInFrames={DUR.tournament}>
        <Tournament />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      <TransitionSeries.Sequence durationInFrames={DUR.capabilities}>
        <Capabilities />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      <TransitionSeries.Sequence durationInFrames={DUR.closing}>
        <Closing />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />

      <TransitionSeries.Sequence durationInFrames={DUR.bridge}>
        <Bridge />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    </AbsoluteFill>
  );
};
