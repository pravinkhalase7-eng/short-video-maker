import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Audio,
} from "remotion";
import { z } from "zod";

import {
  calculateVolume,
  getDuckedMusicVolume,
  getOverlayTiming,
  getSceneSequence,
  shortVideoSchema,
} from "../utils";
import { KenBurnsClip, PunchOverlay } from "./SceneMotion";
import { StoryOverlaySequences } from "./StoryOverlays";
import { ExampleCardOverlay } from "./ExampleCard";
import { SceneCaptions } from "./SceneCaptions";
import { EndCardSfx, SceneSfx } from "./SceneSfx";

export const ShortVideo: React.FC<
  z.infer<typeof shortVideoSchema> & { variant: "portrait" | "landscape" }
> = ({ scenes, music, config, variant }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: totalFrames } = useVideoConfig();
  const captionBackgroundColor = config.captionBackgroundColor ?? "blue";
  const captionPosition = config.captionPosition ?? "center";
  const [baseVolume, musicMuted] = calculateVolume(config.musicVolume);
  const { hookFrames, endCardFrom } = getOverlayTiming({
    durationMs: (totalFrames / fps) * 1000,
    paddingBack: config.paddingBack,
    hookDurationMs: config.hookDurationMs ?? 2200,
    fps,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "white" }}>
      <Audio
        loop
        src={music.url}
        startFrom={music.start * fps}
        endAt={music.end * fps}
        volume={(f) =>
          getDuckedMusicVolume({
            frame: f,
            baseVolume,
            muted: musicMuted,
            endCardFrom,
          })
        }
        muted={musicMuted}
      />

      {scenes.map((scene, i) => {
        const { captions, audio, video } = scene;
        const { startFrame, durationInFrames } = getSceneSequence({
          scenes,
          index: i,
          fps,
          hookFrames: config.hookText?.trim() ? hookFrames : 0,
        });
        const audioDelayFrames =
          i === 0 && config.hookText?.trim() ? hookFrames : 0;
        const spokenFrames =
          i === scenes.length - 1
            ? Math.max(
                12,
                durationInFrames -
                  audioDelayFrames -
                  Math.max(0, totalFrames - endCardFrom),
              )
            : durationInFrames - audioDelayFrames;
        const hasCard = Boolean(scene.exampleCard?.body?.trim());
        const delayFrames =
          i === 0
            ? hookFrames
            : Math.max(8, Math.round(spokenFrames * 0.18));

        return (
          <Sequence
            from={startFrame}
            durationInFrames={durationInFrames}
            key={`scene-${i}`}
          >
            <KenBurnsClip
              src={video}
              durationInFrames={durationInFrames}
              index={i}
              kind={scene.kind}
            />
            {audioDelayFrames > 0 ? (
              <Sequence from={audioDelayFrames}>
                <Audio src={audio.url} />
              </Sequence>
            ) : (
              <Audio src={audio.url} />
            )}
            <SceneSfx sfx={config.sfx} sceneIndex={i} fps={fps} />
            {hasCard && scene.exampleCard ? (
              <ExampleCardOverlay
                card={scene.exampleCard}
                variant={variant}
                delayFrames={delayFrames}
                sceneFrames={spokenFrames}
              />
            ) : scene.overlayText?.trim() ? (
              <PunchOverlay
                text={scene.overlayText}
                variant={variant}
                delayFrames={delayFrames}
                sceneFrames={spokenFrames}
              />
            ) : null}
            <SceneCaptions
              captions={captions}
              sceneIndex={i}
              sceneStartFrame={startFrame + audioDelayFrames}
              compositionFrame={frame}
              fps={fps}
              hookFrames={0}
              endCardFrom={endCardFrom}
              variant={variant}
              captionPosition={captionPosition}
              captionBackgroundColor={captionBackgroundColor}
              quiet={hasCard || i === 0}
            />
          </Sequence>
        );
      })}
      <StoryOverlaySequences config={config} variant={variant} />
      <EndCardSfx sfx={config.sfx} from={endCardFrom} fps={fps} />
    </AbsoluteFill>
  );
};
