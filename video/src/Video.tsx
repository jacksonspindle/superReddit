import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { S01Opening } from "./scenes/S01Opening";
import { S02Signals } from "./scenes/S02Signals";
import { S03Alerts } from "./scenes/S03Alerts";
import { S04SwipeQueue } from "./scenes/S04SwipeQueue";
import { S05ChatOverlay } from "./scenes/S05ChatOverlay";
import { S06AI } from "./scenes/S06AI";
import { S07CTA } from "./scenes/S07CTA";
import { SCENES, TRANSITION_DURATION } from "./theme";

const fadeTiming = linearTiming({ durationInFrames: TRANSITION_DURATION });
const fadePresentation = fade();

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES.S01.duration}>
          <S01Opening />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fadePresentation}
          timing={fadeTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.S02.duration}>
          <S02Signals />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fadePresentation}
          timing={fadeTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.S03.duration}>
          <S03Alerts />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fadePresentation}
          timing={fadeTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.S04.duration}>
          <S04SwipeQueue />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fadePresentation}
          timing={fadeTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.S05.duration}>
          <S05ChatOverlay />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fadePresentation}
          timing={fadeTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.S06.duration}>
          <S06AI />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fadePresentation}
          timing={fadeTiming}
        />

        <TransitionSeries.Sequence durationInFrames={SCENES.S07.duration}>
          <S07CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
