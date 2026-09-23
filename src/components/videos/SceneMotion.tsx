import {
  AbsoluteFill,
  Freeze,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReactNode } from "react";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";

const { fontFamily } = loadFont();

export const KenBurnsClip: React.FC<{
  src: string;
  durationInFrames: number;
  index: number;
  kind?: "video" | "image";
  freeze?: boolean;
}> = ({ src, durationInFrames, index, kind, freeze }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoomIn = index % 2 === 0;
  const scale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    zoomIn ? [1, 1.08] : [1.08, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const isImage =
    kind === "image" || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(src);
  const mediaStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  };

  const media = isImage ? (
    <Img src={src} style={mediaStyle} />
  ) : freeze ? (
    <OffthreadVideo
      src={src}
      muted
      toneMapped={false}
      acceptableTimeShiftInSeconds={1}
      style={mediaStyle}
    />
  ) : (
    <LoopingVideo src={src} durationInFrames={durationInFrames} fps={fps} />
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {freeze ? <Freeze frame={4}>{media}</Freeze> : media}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const LoopingVideo: React.FC<{
  src: string;
  durationInFrames: number;
  fps: number;
}> = ({ src, durationInFrames, fps }) => {
  const restartEvery = Math.max(80, Math.round(fps * 8));
  const loops = Math.max(1, Math.ceil(durationInFrames / restartEvery));
  const mediaStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  };

  return (
    <>
      {Array.from({ length: loops }, (_, index) => {
        const from = index * restartEvery;
        const length = Math.min(restartEvery, durationInFrames - from);
        if (length <= 0) {
          return null;
        }
        return (
          <Sequence
            key={`loop-${index}`}
            from={from}
            durationInFrames={length}
          >
            <OffthreadVideo
              src={src}
              muted
              toneMapped={false}
              acceptableTimeShiftInSeconds={1}
              style={mediaStyle}
            />
          </Sequence>
        );
      })}
    </>
  );
};

export const CutHit: React.FC<{
  strong?: boolean;
  children: ReactNode;
}> = ({ strong = false, children }) => {
  const frame = useCurrentFrame();
  const flash = interpolate(
    frame,
    [0, 2, strong ? 8 : 5],
    strong ? [0.72, 0.28, 0] : [0.42, 0.14, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const punch = interpolate(
    frame,
    [0, 3, 9],
    strong ? [1.16, 1.06, 1] : [1.1, 1.03, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(255,255,255,${flash})`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const SceneBroll: React.FC<{
  clips: { url: string; kind?: "video" | "image" }[];
  windows: { from: number; durationInFrames: number }[];
  sceneIndex: number;
  freezeAnswer?: boolean;
}> = ({ clips, windows, sceneIndex, freezeAnswer }) => {
  return (
    <>
      {windows.map((window, index) => {
        const clip = clips[index] || clips[clips.length - 1];
        const skipHit = sceneIndex === 0 && index === 0;
        const media = (
          <KenBurnsClip
            src={clip.url}
            durationInFrames={window.durationInFrames}
            index={sceneIndex * 3 + index}
            kind={clip.kind}
            freeze={Boolean(freezeAnswer && index === windows.length - 1)}
          />
        );
        return (
          <Sequence
            key={`broll-${sceneIndex}-${index}`}
            from={window.from}
            durationInFrames={window.durationInFrames}
          >
            {skipHit ? media : <CutHit strong={Boolean(freezeAnswer)}>{media}</CutHit>}
          </Sequence>
        );
      })}
    </>
  );
};

export const PunchOverlay: React.FC<{
  text: string;
  variant: "portrait" | "landscape";
  delayFrames: number;
  sceneFrames: number;
}> = ({ text, variant, delayFrames, sceneFrames }) => {
  const frame = useCurrentFrame();
  const punch = text.trim();
  if (!punch || sceneFrames < 12) {
    return null;
  }

  const start = Math.min(Math.max(delayFrames, 6), Math.max(6, sceneFrames - 24));
  const hold = Math.min(40, Math.max(16, Math.round(sceneFrames * 0.32)));
  const opacity = interpolate(
    frame,
    [start, start + 5, start + hold, start + hold + 7],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const scale = interpolate(frame, [start, start + 6], [0.86, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
        opacity,
      }}
    >
      <p
        style={{
          margin: 0,
          transform: `scale(${scale})`,
          fontFamily,
          fontWeight: 900,
          fontSize:
            punch.length <= 3
              ? isPortrait
                ? "9em"
                : "7em"
              : isPortrait
                ? "5.4em"
                : "4.4em",
          lineHeight: 1,
          color: "white",
          textAlign: "center",
          textTransform: "uppercase",
          WebkitTextStroke: "3px black",
          textShadow: "0 10px 28px rgba(0,0,0,0.75)",
          padding: "0 40px",
        }}
      >
        {punch}
      </p>
    </AbsoluteFill>
  );
};
