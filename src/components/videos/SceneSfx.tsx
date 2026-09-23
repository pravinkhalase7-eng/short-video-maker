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
