import React from "react";
import { Composition, Folder } from "remotion";
import { Video } from "./Video";
import { S01Opening } from "./scenes/S01Opening";
import { S02Signals } from "./scenes/S02Signals";
import { S03Alerts } from "./scenes/S03Alerts";
import { S04SwipeQueue } from "./scenes/S04SwipeQueue";
import { S05ChatOverlay } from "./scenes/S05ChatOverlay";
import { S06AI } from "./scenes/S06AI";
import { S07CTA } from "./scenes/S07CTA";
import { COMP, SCENES } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full video composition */}
      <Composition
        id="Video"
        component={Video}
        durationInFrames={COMP.totalFrames}
        fps={COMP.fps}
        width={COMP.width}
        height={COMP.height}
      />

      {/* Individual scenes for preview/debugging */}
      <Folder name="Scenes">
        <Composition
          id="S01-Opening"
          component={S01Opening}
          durationInFrames={SCENES.S01.duration}
          fps={COMP.fps}
          width={COMP.width}
          height={COMP.height}
        />
        <Composition
          id="S02-Signals"
          component={S02Signals}
          durationInFrames={SCENES.S02.duration}
          fps={COMP.fps}
          width={COMP.width}
          height={COMP.height}
        />
        <Composition
          id="S03-Alerts"
          component={S03Alerts}
          durationInFrames={SCENES.S03.duration}
          fps={COMP.fps}
          width={COMP.width}
          height={COMP.height}
        />
        <Composition
          id="S04-SwipeQueue"
          component={S04SwipeQueue}
          durationInFrames={SCENES.S04.duration}
          fps={COMP.fps}
          width={COMP.width}
          height={COMP.height}
        />
        <Composition
          id="S05-ChatOverlay"
          component={S05ChatOverlay}
          durationInFrames={SCENES.S05.duration}
          fps={COMP.fps}
          width={COMP.width}
          height={COMP.height}
        />
        <Composition
          id="S06-AI"
          component={S06AI}
          durationInFrames={SCENES.S06.duration}
          fps={COMP.fps}
          width={COMP.width}
          height={COMP.height}
        />
        <Composition
          id="S07-CTA"
          component={S07CTA}
          durationInFrames={SCENES.S07.duration}
          fps={COMP.fps}
          width={COMP.width}
          height={COMP.height}
        />
      </Folder>
    </>
  );
};
