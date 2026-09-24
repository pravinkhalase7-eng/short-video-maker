import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

const { fontFamily: anton } = loadAnton("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const { fontFamily: outfit } = loadOutfit("normal", {
  weights: ["700", "800"],
  subsets: ["latin"],
});

type Variant = "portrait" | "landscape";

export const QuizSeriesBadge: React.FC<{
  label: string;
  title?: string;
  variant: Variant;
}> = ({ label, title, variant }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div
        style={{
          position: "absolute",
          top: isPortrait ? 72 : 40,
          left: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isPortrait ? 10 : 8,
        }}
      >
        <div
          style={{
            padding: isPortrait ? "10px 22px" : "8px 18px",
            borderRadius: 999,
            backgroundColor: "rgba(8, 10, 24, 0.88)",
            border: "2px solid #FFD166",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: anton,
              fontWeight: 400,
              fontSize: isPortrait ? 28 : 22,
              letterSpacing: 2.2,
              color: "#FFD166",
              lineHeight: 1,
            }}
          >
            {label}
          </p>
        </div>
        {title ? (
          <p
            style={{
              margin: 0,
              fontFamily: outfit,
              fontWeight: 800,
              fontSize: isPortrait ? 34 : 26,
              letterSpacing: 1.4,
              color: "white",
              textTransform: "uppercase",
              textShadow: "0 4px 18px rgba(0,0,0,0.65)",
              lineHeight: 1,
            }}
          >
            {title}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const QuizCommentCta: React.FC<{
  from: number;
  durationInFrames: number;
  variant: Variant;
  play: boolean;
  text?: string;
}> = ({ from, durationInFrames, variant, play, text }) => {
  if (!play || from < 0 || durationInFrames < 10) {
    return null;
  }
  return (
    <Sequence from={from} durationInFrames={durationInFrames} name="CommentCta">
      <CommentStrip
        variant={variant}
        text={text || "COMMENT A · B · C · D"}
      />
    </Sequence>
  );
};

export const QuizSaveCue: React.FC<{
  from: number;
  durationInFrames: number;
  variant: Variant;
  play: boolean;
  codeQuiz: boolean;
}> = ({ from, durationInFrames, variant, play, codeQuiz }) => {
  if (!play || from < 0 || durationInFrames < 10) {
    return null;
  }
  return (
    <Sequence from={from} durationInFrames={durationInFrames} name="SaveCue">
      <CommentStrip
        variant={variant}
        text={
          codeQuiz
            ? "SAVE THIS — IT SHOWS UP IN INTERVIEWS"
            : "SAVE THIS AND TRY IT ON A FRIEND"
        }
      />
    </Sequence>
  );
};

const CommentStrip: React.FC<{ variant: Variant; text: string }> = ({
  variant,
  text,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });
  const rise = interpolate(frame, [0, 8], [16, 0], {
    extrapolateRight: "clamp",
  });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          bottom: isPortrait ? 300 : 140,
          display: "flex",
          justifyContent: "center",
          paddingLeft: 28,
          paddingRight: 28,
          transform: `translateY(${rise}px)`,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: isPortrait ? 980 : 1100,
            padding: isPortrait ? "16px 18px" : "12px 16px",
            borderRadius: 18,
            backgroundColor: "#FFD166",
            boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: outfit,
              fontWeight: 800,
              fontSize: isPortrait ? 32 : 24,
              lineHeight: 1.15,
              color: "#111",
              textAlign: "center",
              letterSpacing: 0.4,
            }}
          >
            {text}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
