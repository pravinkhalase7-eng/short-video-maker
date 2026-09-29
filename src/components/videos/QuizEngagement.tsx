import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { vnEnter, vnTransform } from "./VnMotion";

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

export const QuizTimeUpScreen: React.FC<{
  variant: Variant;
  play: boolean;
}> = ({ variant, play }) => {
  if (!play) {
    return null;
  }
  return <TimeUpStamp variant={variant} />;
};

const TimeUpStamp: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const slam = vnEnter(frame, 0, {
    duration: 12,
    fromY: -80,
    fromScale: 1.4,
  });
  const isPortrait = variant === "portrait";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(8, 10, 24, 0.42)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          top: isPortrait ? "38%" : "32%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isPortrait ? 18 : 12,
          paddingLeft: 48,
          paddingRight: 48,
          transform: vnTransform(slam),
          opacity: slam.opacity,
        }}
      >
        <div
          style={{
            padding: isPortrait ? "22px 36px" : "16px 28px",
            borderRadius: 22,
            backgroundColor: "#E53935",
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
            border: "4px solid #FFD166",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: anton,
              fontWeight: 400,
              fontSize: isPortrait ? 92 : 72,
              letterSpacing: 3,
              color: "white",
              lineHeight: 0.92,
              textAlign: "center",
              textShadow: "0 6px 0 rgba(0,0,0,0.28)",
            }}
          >
            TIME'S UP
          </p>
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: outfit,
            fontWeight: 800,
            fontSize: isPortrait ? 36 : 28,
            letterSpacing: 1.4,
            color: "#FFD166",
            textTransform: "uppercase",
            textAlign: "center",
            textShadow: "0 4px 16px rgba(0,0,0,0.7)",
          }}
        >
          Comment A · B · C · D
        </p>
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
  const [lead, rest] = splitCta(text);
  const plate = vnEnter(frame, 0, {
    duration: 11,
    fromY: 80,
    fromScale: 0.86,
  });
  const leadMotion = vnEnter(frame, 0, {
    duration: 10,
    fromY: -48,
    fromScale: 1.22,
  });
  const restMotion = vnEnter(frame, 6, {
    duration: 10,
    fromX: 72,
  });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: plate.opacity }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: "100%",
          bottom: isPortrait ? 176 : 96,
          display: "flex",
          justifyContent: "center",
          paddingLeft: 28,
          paddingRight: 28,
          transform: vnTransform(plate),
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
            <span
              style={{
                display: "inline-block",
                opacity: leadMotion.opacity,
                transform: vnTransform(leadMotion),
              }}
            >
              {lead}
            </span>
            {rest ? (
              <>
                {" "}
                <span
                  style={{
                    display: "inline-block",
                    opacity: restMotion.opacity,
                    transform: vnTransform(restMotion),
                  }}
                >
                  {rest}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

function splitCta(text: string): [string, string | null] {
  if (text.includes(" — ")) {
    const [lead, rest] = text.split(" — ");
    return [lead, rest || null];
  }
  const mark = text.indexOf("? ");
  if (mark > 0) {
    return [text.slice(0, mark + 1), text.slice(mark + 2)];
  }
  return [text, null];
}
