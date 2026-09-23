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
  isQuizAnswerCard,
  isQuizQuestionCard,
  sceneClips,
  shortVideoSchema,
  splitClipWindows,
} from "../utils";
import { PunchOverlay, SceneBroll } from "./SceneMotion";
import { StoryOverlaySequences } from "./StoryOverlays";
import { ExampleCardOverlay } from "./ExampleCard";
import { SceneCaptions } from "./SceneCaptions";
import { ClipCutSfx, EndCardSfx, QuizAnswerSfx, SceneSfx } from "./SceneSfx";
import { QuizCountdown } from "./QuizCountdown";

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
        const { captions, audio } = scene;
        const clips = sceneClips(scene);
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
        const windows = splitClipWindows(durationInFrames, clips.length);
        const hasCard = Boolean(scene.exampleCard?.body?.trim());
        const quizQuestion = isQuizQuestionCard(scene.exampleCard);
        const quizAnswer = isQuizAnswerCard(scene.exampleCard);
        const holdFrames = Math.min(
          spokenFrames,
          Math.max(
            0,
            Math.round(((scene.holdMs || (quizQuestion ? 3000 : 0)) / 1000) * fps),
          ),
        );
        const countdownFrom = Math.max(
          audioDelayFrames,
          durationInFrames - holdFrames,
        );
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
            <SceneBroll
              clips={clips}
              windows={windows}
              sceneIndex={i}
              freezeAnswer={quizAnswer}
            />
            {audioDelayFrames > 0 ? (
              <Sequence from={audioDelayFrames}>
                <Audio src={audio.url} />
              </Sequence>
            ) : (
              <Audio src={audio.url} />
            )}
            <SceneSfx sfx={config.sfx} sceneIndex={i} fps={fps} />
            {windows.map((window, clipIndex) => (
              <ClipCutSfx
                key={`inner-whoosh-${i}-${clipIndex}`}
                sfx={config.sfx}
                from={window.from}
                fps={fps}
                play={window.from > 0}
              />
            ))}
            <QuizAnswerSfx sfx={config.sfx} fps={fps} play={quizAnswer} />
            {quizQuestion ? (
              <QuizCountdown
                from={countdownFrom}
                durationInFrames={Math.max(0, durationInFrames - countdownFrom)}
                fps={fps}
                tickUrl={config.sfx?.click}
                variant={variant}
              />
            ) : null}
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
