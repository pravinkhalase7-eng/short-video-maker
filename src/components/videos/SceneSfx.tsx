import { Audio, Sequence } from "remotion";

type SfxUrls = {
  whoosh: string;
  pop: string;
  click: string;
  sting: string;
  beep?: string;
  clap?: string;
  correct?: string;
  tick?: string;
  count?: string;
};

export const SceneSfx: React.FC<{
  sfx?: SfxUrls;
  sceneIndex: number;
  fps: number;
  play?: boolean;
}> = ({ sfx, sceneIndex, fps, play = true }) => {
  if (!play || !sfx?.whoosh || sceneIndex === 0) {
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

export const QuizOptionTicks: React.FC<{
  tickUrl?: string;
  fps: number;
  count: number;
  from: number;
  step: number;
  play: boolean;
}> = ({ tickUrl, fps, count, from, step, play }) => {
  if (!play || !tickUrl || count <= 0) {
    return null;
  }
  const length = Math.max(6, Math.round(0.2 * fps));
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Sequence
          key={`option-tick-${index}`}
          from={from + index * step}
          durationInFrames={length}
          name={`OptionTick${index + 1}`}
        >
          <Audio src={tickUrl} volume={0.78} acceptableTimeShiftInSeconds={1} />
        </Sequence>
      ))}
    </>
  );
};

export const QuizWatchTicks: React.FC<{
  tickUrl?: string;
  from: number;
  durationInFrames: number;
  fps: number;
  play: boolean;
}> = ({ tickUrl, from, durationInFrames, fps, play }) => {
  if (!play || !tickUrl || from < 0 || durationInFrames < 6) {
    return null;
  }
  const step = Math.max(1, Math.round(fps));
  const count = Math.max(1, Math.floor(durationInFrames / step));
  const length = Math.max(6, Math.round(0.16 * fps));
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <Sequence
          key={`watch-tick-${index}`}
          from={from + index * step}
          durationInFrames={length}
          name={`WatchTick${index + 1}`}
        >
          <Audio src={tickUrl} volume={1} acceptableTimeShiftInSeconds={1} />
        </Sequence>
      ))}
    </>
  );
};

export const QuizAnswerSfx: React.FC<{
  sfx?: SfxUrls;
  fps: number;
  play: boolean;
}> = ({ sfx, fps, play }) => {
  const reveal = sfx?.correct || sfx?.pop || sfx?.sting;
  if (!play || !reveal) {
    return null;
  }
  return (
    <Sequence
      from={0}
      durationInFrames={Math.max(12, Math.round(0.85 * fps))}
      name="AnswerReveal"
    >
      <Audio src={reveal} volume={1} acceptableTimeShiftInSeconds={1} />
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
