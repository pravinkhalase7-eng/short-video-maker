import { Audio, Sequence } from "remotion";

type SfxUrls = {
  whoosh: string;
  pop: string;
  click: string;
  sting: string;
};

export const SceneSfx: React.FC<{
  sfx?: SfxUrls;
  sceneIndex: number;
  fps: number;
}> = ({ sfx, sceneIndex, fps }) => {
  if (!sfx?.whoosh || sceneIndex === 0) {
    return null;
  }
  const whooshFrames = Math.max(6, Math.round(0.18 * fps));
  return (
    <Sequence from={0} durationInFrames={whooshFrames} name="CutWhoosh">
      <Audio src={sfx.whoosh} volume={0.16} />
    </Sequence>
  );
};

export const ClipCutSfx: React.FC<{
  sfx?: SfxUrls;
  from: number;
  fps: number;
  play: boolean;
}> = ({ sfx, from, fps, play }) => {
  if (!play || !sfx?.whoosh || from <= 0) {
    return null;
  }
  const whooshFrames = Math.max(6, Math.round(0.16 * fps));
  return (
    <Sequence from={from} durationInFrames={whooshFrames} name="InnerWhoosh">
      <Audio src={sfx.whoosh} volume={0.12} />
    </Sequence>
  );
};

export const QuizAnswerSfx: React.FC<{
  sfx?: SfxUrls;
  fps: number;
  play: boolean;
}> = ({ sfx, fps, play }) => {
  if (!play || !sfx?.sting) {
    return null;
  }
  return (
    <Sequence
      from={0}
      durationInFrames={Math.max(8, Math.round(0.28 * fps))}
      name="AnswerSting"
    >
      <Audio src={sfx.sting} volume={0.22} />
    </Sequence>
  );
};

export const EndCardSfx: React.FC<{
  sfx?: SfxUrls;
  from: number;
  fps: number;
}> = ({ sfx, from, fps }) => {
  if (!sfx?.sting || from <= 0) {
    return null;
  }
  return (
    <Sequence
      from={from}
      durationInFrames={Math.max(6, Math.round(0.22 * fps))}
      name="EndSting"
    >
      <Audio src={sfx.sting} volume={0.18} />
    </Sequence>
  );
};
