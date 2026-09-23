import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";

const { fontFamily } = loadFont();

export const KenBurnsClip: React.FC<{
  src: string;
  durationInFrames: number;
  index: number;
  kind?: "video" | "image";
}> = ({ src, durationInFrames, index, kind }) => {
  const frame = useCurrentFrame();
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

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {isImage ? (
          <Img src={src} style={mediaStyle} />
        ) : (
          <OffthreadVideo
            src={src}
            muted
            toneMapped={false}
            acceptableTimeShiftInSeconds={1}
            style={mediaStyle}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
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
