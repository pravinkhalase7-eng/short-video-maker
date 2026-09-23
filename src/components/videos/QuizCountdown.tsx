import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";

const { fontFamily } = loadFont();

export const QuizCountdown: React.FC<{
  from: number;
  durationInFrames: number;
  fps: number;
  tickUrl?: string;
  variant: "portrait" | "landscape";
}> = ({ from, durationInFrames, fps, tickUrl, variant }) => {
  if (from < 0 || durationInFrames < 18) {
    return null;
  }

  const step = Math.max(Math.round(0.55 * fps), Math.floor(durationInFrames / 3));
  const numbers = [3, 2, 1];
  const isPortrait = variant === "portrait";

  return (
    <>
      {numbers.map((value, index) => {
        const start = from + index * step;
        const length = index === 2 ? durationInFrames - index * step : step;
        if (start >= from + durationInFrames || length <= 0) {
          return null;
        }
        return (
          <Sequence
            key={`quiz-count-${value}`}
            from={start}
            durationInFrames={length}
            name={`Countdown${value}`}
          >
            <CountdownDigit value={value} isPortrait={isPortrait} />
            {tickUrl ? (
              <Audio src={tickUrl} volume={0.22} />
            ) : null}
          </Sequence>
        );
      })}
    </>
  );
};

const CountdownDigit: React.FC<{
  value: number;
  isPortrait: boolean;
}> = ({ value, isPortrait }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 5, 12], [0.7, 1.12, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ring = interpolate(frame, [0, 16], [0.2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
        paddingBottom: isPortrait ? 420 : 240,
      }}
    >
      <div
        style={{
          width: isPortrait ? 220 : 180,
          height: isPortrait ? 220 : 180,
          borderRadius: 999,
          border: `${isPortrait ? 10 : 8}px solid rgba(255,209,102,${0.35 + ring * 0.55})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(8,10,18,0.55)",
          transform: `scale(${scale})`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily,
            fontWeight: 900,
            fontSize: isPortrait ? "5.6em" : "4.4em",
            color: "#FFD166",
            WebkitTextStroke: "3px black",
            lineHeight: 1,
          }}
        >
          {value}
        </p>
      </div>
    </AbsoluteFill>
  );
};
