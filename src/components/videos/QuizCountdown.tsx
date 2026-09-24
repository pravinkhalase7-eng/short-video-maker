import { Fragment } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";

const { fontFamily } = loadFont();

export const QuizClockTimer: React.FC<{
  from: number;
  durationInFrames: number;
  fps: number;
  variant: "portrait" | "landscape";
}> = ({ from, durationInFrames, fps, variant }) => {
  if (from < 0 || durationInFrames < 12) {
    return null;
  }
  return (
    <Sequence from={from} durationInFrames={durationInFrames} name="QuizClock">
      <ClockFace
        fps={fps}
        durationInFrames={durationInFrames}
        isPortrait={variant === "portrait"}
      />
    </Sequence>
  );
};

export const QuizCountdown: React.FC<{
  from: number;
  durationInFrames: number;
  fps: number;
  step?: number;
  tickUrl?: string;
  variant: "portrait" | "landscape";
}> = ({ from, durationInFrames, fps, step, tickUrl, variant }) => {
  if (from < 0 || durationInFrames < 18) {
    return null;
  }

  const tick = Math.max(Math.round(fps), step || 0);
  const numbers = [3, 2, 1];
  const isPortrait = variant === "portrait";
  const beepFrames = Math.max(10, Math.round(0.32 * fps));

  return (
    <>
      {numbers.map((value, index) => {
        const start = from + index * tick;
        const length = index === 2 ? durationInFrames - index * tick : tick;
        if (start >= from + durationInFrames || length <= 0) {
          return null;
        }
        return (
          <Fragment key={`quiz-count-${value}`}>
            <Sequence
              from={start}
              durationInFrames={length}
              name={`Countdown${value}`}
            >
              <CountdownDigit
                value={value}
                isPortrait={isPortrait}
                length={length}
              />
            </Sequence>
            {tickUrl ? (
              <Sequence
                from={start}
                durationInFrames={Math.min(length, beepFrames)}
                name={`CountdownBeep${value}`}
              >
                <Audio
                  src={tickUrl}
                  volume={0.38}
                  acceptableTimeShiftInSeconds={1}
                />
              </Sequence>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
};

const CountdownDigit: React.FC<{
  value: number;
  isPortrait: boolean;
  length: number;
}> = ({ value, isPortrait, length }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 5, 12], [0.72, 1.08, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const remaining = interpolate(frame, [0, Math.max(1, length)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dim = interpolate(frame, [0, 6], [0, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const size = isPortrait ? 280 : 230;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(4, 6, 18, ${dim})`,
        }}
      />
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          transform: `scale(${scale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="rgba(8,10,24,0.86)"
            stroke="rgba(255,209,102,0.22)"
            strokeWidth={isPortrait ? 14 : 12}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#FFD166"
            strokeWidth={isPortrait ? 14 : 12}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - remaining)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <p
          style={{
            margin: 0,
            fontFamily,
            fontWeight: 900,
            fontSize: isPortrait ? "5.6em" : "4.6em",
            color: "#FFD166",
            WebkitTextStroke: "4px black",
            lineHeight: 1,
          }}
        >
          {value}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const ClockFace: React.FC<{
  fps: number;
  durationInFrames: number;
  isPortrait: boolean;
}> = ({ fps, durationInFrames, isPortrait }) => {
  const frame = useCurrentFrame();
  const total = durationInFrames / Math.max(1, fps);
  const remaining = Math.max(0, total - frame / Math.max(1, fps));
  const display = Math.max(1, Math.ceil(remaining));
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const secondAngle = progress * 360;
  const tickPulse = interpolate(
    frame % Math.max(1, Math.round(fps)),
    [0, 4, 10],
    [1.06, 1, 1],
    { extrapolateRight: "clamp" },
  );
  const size = isPortrait ? 118 : 96;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;
  const marks = Array.from({ length: 12 }, (_, index) => {
    const angle = ((index * 30 - 90) * Math.PI) / 180;
    const inner = index % 3 === 0 ? radius - 10 : radius - 6;
    return {
      x1: cx + Math.cos(angle) * inner,
      y1: cy + Math.sin(angle) * inner,
      x2: cx + Math.cos(angle) * (radius - 2),
      y2: cy + Math.sin(angle) * (radius - 2),
      wide: index % 3 === 0,
    };
  });
  const hand = (angle: number, length: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + Math.cos(rad) * length,
      y: cy + Math.sin(rad) * length,
    };
  };
  const second = hand(secondAngle, radius - 14);
  const minute = hand(secondAngle * 0.2, radius - 28);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: isPortrait ? 22 : 16,
          right: isPortrait ? 22 : 28,
          transform: `scale(${tickPulse})`,
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius + 3}
            fill="rgba(8,10,24,0.94)"
            stroke="#FFD166"
            strokeWidth={isPortrait ? 5 : 4}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="#14182c"
            stroke="rgba(255,209,102,0.28)"
            strokeWidth={1.5}
          />
          {marks.map((mark, index) => (
            <line
              key={`clock-mark-${index}`}
              x1={mark.x1}
              y1={mark.y1}
              x2={mark.x2}
              y2={mark.y2}
              stroke="#FFD166"
              strokeWidth={mark.wide ? 2.5 : 1.2}
              strokeLinecap="round"
            />
          ))}
          <line
            x1={cx}
            y1={cy}
            x2={minute.x}
            y2={minute.y}
            stroke="white"
            strokeWidth={isPortrait ? 3.5 : 3}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={second.x}
            y2={second.y}
            stroke="#FF4D6D"
            strokeWidth={isPortrait ? 2.5 : 2}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={4} fill="#FFD166" />
        </svg>
        <p
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: isPortrait ? -22 : -18,
            margin: 0,
            fontFamily,
            fontWeight: 900,
            fontSize: isPortrait ? 22 : 18,
            color: "#FFD166",
            WebkitTextStroke: "2px black",
            lineHeight: 1,
            textAlign: "center",
            letterSpacing: 0.6,
          }}
        >
          {`0:${String(display).padStart(2, "0")}`}
        </p>
      </div>
    </AbsoluteFill>
  );
};
