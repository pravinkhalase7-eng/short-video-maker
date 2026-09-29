import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import { vnEnter, vnTransform } from "./VnMotion";

const { fontFamily } = loadFont();

export const QuizClockTimer: React.FC<{
  from: number;
  durationInFrames: number;
  fps: number;
  variant: "portrait" | "landscape";
  tickUrl?: string;
}> = ({ from, durationInFrames, fps, variant, tickUrl }) => {
  if (from < 0 || durationInFrames < 12) {
    return null;
  }
  const step = Math.max(1, Math.round(fps));
  const countLast = step * 3;
  const countStart = Math.max(0, durationInFrames - countLast);
  const beepFrames = Math.max(10, Math.round(0.32 * fps));
  return (
    <>
      <Sequence from={from} durationInFrames={durationInFrames} name="QuizClock">
        <ClockFace
          fps={fps}
          durationInFrames={durationInFrames}
          isPortrait={variant === "portrait"}
        />
      </Sequence>
      {tickUrl
        ? [0, 1, 2].map((index) => {
            const start = from + countStart + index * step;
            if (start >= from + durationInFrames) {
              return null;
            }
            return (
              <Sequence
                key={`clock-count-${index}`}
                from={start}
                durationInFrames={Math.min(
                  beepFrames,
                  from + durationInFrames - start,
                )}
                name={`ClockCount${3 - index}`}
              >
                <Audio
                  src={tickUrl}
                  volume={0.38}
                  acceptableTimeShiftInSeconds={1}
                />
              </Sequence>
            );
          })
        : null}
    </>
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
  const display = Math.max(0, Math.ceil(remaining));
  const urgent = remaining <= 3.05;
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const secondAngle = progress * 360;
  const tickPulse = interpolate(
    frame % Math.max(1, Math.round(fps)),
    [0, 4, 10],
    [urgent ? 1.14 : 1.06, 1, 1],
    { extrapolateRight: "clamp" },
  );
  const slide = vnEnter(frame, 0, {
    duration: 11,
    fromX: 140,
    fromScale: 0.7,
  });
  const size = isPortrait ? 200 : 156;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 12;
  const marks = Array.from({ length: 12 }, (_, index) => {
    const angle = ((index * 30 - 90) * Math.PI) / 180;
    const inner = index % 3 === 0 ? radius - 16 : radius - 9;
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
  const second = hand(secondAngle, radius - 22);
  const minute = hand(secondAngle * 0.2, radius - 44);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "auto",
          bottom: isPortrait ? 430 : 200,
          right: isPortrait ? 28 : 32,
          transform: `${vnTransform(slide)} scale(${tickPulse})`,
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={cx}
            cy={cy}
            r={radius + 3}
            fill="rgba(8,10,24,0.94)"
            stroke="#FFD166"
            strokeWidth={isPortrait ? 8 : 6}
          />
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill={urgent ? "#2a1018" : "#14182c"}
            stroke="rgba(255,209,102,0.28)"
            strokeWidth={2.4}
          />
          {marks.map((mark, index) => (
            <line
              key={`clock-mark-${index}`}
              x1={mark.x1}
              y1={mark.y1}
              x2={mark.x2}
              y2={mark.y2}
              stroke="#FFD166"
              strokeWidth={mark.wide ? 4 : 2}
              strokeLinecap="round"
            />
          ))}
          <line
            x1={cx}
            y1={cy}
            x2={minute.x}
            y2={minute.y}
            stroke="white"
            strokeWidth={isPortrait ? 5.5 : 4.5}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={second.x}
            y2={second.y}
            stroke="#FF4D6D"
            strokeWidth={isPortrait ? 4 : 3.2}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={7} fill="#FFD166" />
        </svg>
        <p
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: isPortrait ? -36 : -28,
            margin: 0,
            fontFamily,
            fontWeight: 900,
            fontSize: isPortrait ? (urgent ? 44 : 34) : urgent ? 34 : 26,
            color: urgent ? "#FF4D6D" : "#FFD166",
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
