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
  parseQuizSheet,
  quizCountdownTiming,
  quizOptionReveal,
  sceneClips,
  shortVideoSchema,
  splitClipWindows,
  usesHardcodedWorksheet,
} from "../utils";
import { PunchOverlay, QuizDeskBackground, SceneBroll } from "./SceneMotion";
import { StoryOverlaySequences } from "./StoryOverlays";
import { ExampleCardOverlay } from "./ExampleCard";
import { SceneCaptions } from "./SceneCaptions";
import {
  ClipCutSfx,
  EndCardSfx,
  QuizAnswerSfx,
  QuizOptionTicks,
  SceneSfx,
} from "./SceneSfx";
import { QuizClockTimer, QuizCountdown } from "./QuizCountdown";
import { QuizCommentCta } from "./QuizEngagement";

export const ShortVideo: React.FC<
  z.infer<typeof shortVideoSchema> & { variant: "portrait" | "landscape" }
> = ({ scenes, music, config, variant }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: totalFrames } = useVideoConfig();
  const captionBackgroundColor = config.captionBackgroundColor ?? "blue";
  const captionPosition = config.captionPosition ?? "center";
  const [baseVolume, musicMuted] = calculateVolume(config.musicVolume);
  const quizMode = usesHardcodedWorksheet(config, scenes);
  const useHook = !quizMode && Boolean(config.hookText?.trim());
  const { hookFrames, endCardFrom } = getOverlayTiming({
    durationMs: (totalFrames / fps) * 1000,
    paddingBack: config.paddingBack,
    hookDurationMs: useHook ? config.hookDurationMs ?? 2200 : 0,
    fps,
  });
  const quizBeepDucks = scenes.flatMap((scene, index) => {
    if (!isQuizQuestionCard(scene.exampleCard, scene.overlayText)) {
      return [];
    }
    const { startFrame, durationInFrames } = getSceneSequence({
      scenes,
      index,
      fps,
      hookFrames: useHook ? hookFrames : 0,
    });
    const optionReveal = quizOptionReveal({ fps, delayFrames: 0 });
    const sheet = scene.exampleCard
      ? parseQuizSheet(scene.exampleCard)
      : null;
    const countdown = quizCountdownTiming({
      fps,
      optionFrom: optionReveal.from,
      optionStep: optionReveal.step,
      optionCount: sheet?.options.length || 0,
      sceneFrames: durationInFrames,
    });
    return [
      {
        from: startFrame + countdown.from,
        durationInFrames: countdown.durationInFrames,
      },
    ];
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
            duckRanges: quizBeepDucks,
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
          hookFrames: useHook ? hookFrames : 0,
        });
        const audioDelayFrames = i === 0 && useHook ? hookFrames : 0;
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
        const quizQuestion = isQuizQuestionCard(
          scene.exampleCard,
          scene.overlayText,
        );
        const quizAnswer = isQuizAnswerCard(
          scene.exampleCard,
          scene.overlayText,
        );
        const worksheet =
          usesHardcodedWorksheet(config, scenes) || quizQuestion || quizAnswer;
        const windows = splitClipWindows(
          durationInFrames,
          worksheet ? 1 : clips.length,
        );
        const delayFrames =
          quizQuestion || quizAnswer
            ? 0
            : i === 0
              ? hookFrames
              : Math.max(8, Math.round(spokenFrames * 0.18));
        const optionReveal = quizOptionReveal({ fps, delayFrames });
        const quizSheet = scene.exampleCard
          ? parseQuizSheet(scene.exampleCard)
          : null;
        const quizOptions = quizSheet?.options.length || 0;
        const countdown = quizQuestion
          ? quizCountdownTiming({
              fps,
              optionFrom: optionReveal.from,
              optionStep: optionReveal.step,
              optionCount: quizOptions,
              sceneFrames: durationInFrames,
              audioDelayFrames,
            })
          : {
              guessFrom: 0,
              guessDuration: 0,
              tickFrom: 0,
              tickDuration: 0,
              from: 0,
              durationInFrames: 0,
              step: Math.round(fps),
            };
        const countBeep =
          config.sfx?.count || config.sfx?.beep || config.sfx?.pop;

        return (
          <Sequence
            from={startFrame}
            durationInFrames={durationInFrames}
            key={`scene-${i}`}
          >
            {worksheet ? (
              <QuizDeskBackground />
            ) : (
              <SceneBroll
                clips={clips}
                windows={windows}
                sceneIndex={i}
                freezeAnswer={quizAnswer}
              />
            )}
            {audioDelayFrames > 0 ? (
              <Sequence from={audioDelayFrames}>
                <Audio src={audio.url} />
              </Sequence>
            ) : (
              <Audio src={audio.url} />
            )}
            <SceneSfx
              sfx={config.sfx}
              sceneIndex={i}
              fps={fps}
              play={!worksheet}
            />
            {worksheet
              ? null
              : windows.map((window, clipIndex) => (
                  <ClipCutSfx
                    key={`inner-whoosh-${i}-${clipIndex}`}
                    sfx={config.sfx}
                    from={window.from}
                    fps={fps}
                    play={window.from > 0}
                  />
                ))}
            <QuizOptionTicks
              tickUrl={config.sfx?.pop || config.sfx?.beep || config.sfx?.click}
              fps={fps}
              count={quizOptions}
              from={optionReveal.from}
              step={optionReveal.step}
              play={quizQuestion}
            />
            <QuizAnswerSfx sfx={config.sfx} fps={fps} play={quizAnswer} />
            {hasCard && scene.exampleCard ? (
              <ExampleCardOverlay
                card={scene.exampleCard}
                answerLetter={
                  /^[A-D]$/i.test(scene.overlayText || "")
                    ? scene.overlayText
                    : undefined
                }
                variant={variant}
                delayFrames={delayFrames}
                sceneFrames={spokenFrames}
                optionFrom={optionReveal.from}
                optionStep={optionReveal.step}
              />
            ) : scene.overlayText?.trim() ? (
              <PunchOverlay
                text={scene.overlayText}
                variant={variant}
                delayFrames={delayFrames}
                sceneFrames={spokenFrames}
              />
            ) : null}
            {quizQuestion ? (
              <>
                <QuizCommentCta
                  from={countdown.guessFrom}
                  durationInFrames={countdown.guessDuration}
                  variant={variant}
                  play={countdown.guessDuration >= 12}
                  text="LOCK YOUR GUESS — COMMENT A · B · C · D"
                />
                <QuizClockTimer
                  from={countdown.guessFrom}
                  durationInFrames={countdown.guessDuration}
                  fps={fps}
                  variant={variant}
                />
                <QuizCountdown
                  from={countdown.from}
                  durationInFrames={countdown.durationInFrames}
                  step={countdown.step}
                  fps={fps}
                  tickUrl={countBeep}
                  variant={variant}
                />
              </>
            ) : null}
            {quizAnswer ? (
              <QuizCommentCta
                from={0}
                durationInFrames={Math.max(18, spokenFrames)}
                variant={variant}
                play
                text="CHECK THE CAPTIONS FOR THE EXPLANATION"
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
