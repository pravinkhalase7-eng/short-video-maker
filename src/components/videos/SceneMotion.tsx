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

export const QuizDeskBackground: React.FC<{ lang?: string }> = ({ lang }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 240], [0, 1], {
    extrapolateRight: "extend",
  });
  const tint =
    lang === "JAVA"
      ? "#f89820"
      : lang === "JS"
        ? "#f7df1e"
        : lang === "SQL"
          ? "#61dafb"
          : "#3776AB";

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #1a2740 0%, #0c1422 48%, #070d16 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.14,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 31px, rgba(94,200,240,0.12) 32px), repeating-linear-gradient(90deg, transparent 0px, transparent 31px, rgba(94,200,240,0.08) 32px)",
        }}
      />
      {[
        { top: "4%", left: "6%", size: 118, rotate: -18, opacity: 0.55 },
        { top: "8%", right: "4%", size: 92, rotate: 22, opacity: 0.4 },
        { top: "38%", right: "-4%", size: 160, rotate: -8, opacity: 0.28 },
        { top: "62%", left: "8%", size: 150, rotate: 16, opacity: 0.42 },
        { top: "78%", right: "10%", size: 120, rotate: -24, opacity: 0.5 },
      ].map((mark, index) => (
        <div
          key={`logo-${index}`}
          style={{
            position: "absolute",
            top: mark.top,
            left: mark.left,
            right: mark.right,
            opacity: mark.opacity,
            transform: `translateY(${Math.sin((drift + index) * 4) * 10}px) rotate(${mark.rotate}deg)`,
          }}
        >
          <LangMark lang={lang} size={mark.size} accent={tint} />
        </div>
      ))}
      {[
        { top: "6%", left: "4%", text: "{ }", size: 56 },
        { top: "12%", right: "18%", text: "[ ]", size: 48 },
        { top: "28%", left: "3%", text: "[ ]", size: 42 },
        { top: "34%", right: "5%", text: ">>", size: 52 },
        { top: "44%", right: "6%", text: "C>", size: 48 },
        { top: "58%", right: "8%", text: "→", size: 54 },
      ].map((glyph) => (
        <span
          key={glyph.text + glyph.top}
          style={{
            position: "absolute",
            top: glyph.top,
            left: glyph.left,
            right: glyph.right,
            color: tint,
            opacity: 0.22,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: glyph.size,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {glyph.text}
        </span>
      ))}
      <pre
        style={{
          position: "absolute",
          top: 40,
          left: 36,
          margin: 0,
          color: "#8fb4d9",
          opacity: 0.16,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 18,
          lineHeight: 1.55,
          whiteSpace: "pre",
        }}
      >
        {`dst.tas\nprint(x // y)\ndest.grade = "hit"\nwhile _ <= i:`}
      </pre>
      <pre
        style={{
          position: "absolute",
          bottom: 80,
          right: 24,
          margin: 0,
          color: "#8fb4d9",
          opacity: 0.14,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 16,
          lineHeight: 1.5,
          textAlign: "right",
          whiteSpace: "pre",
        }}
      >
        {`if x_local != none:\n    print(x // y)\nelse:\n    print(cont)`}
      </pre>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(7,13,22,0.15) 0%, transparent 18%, transparent 72%, rgba(7,13,22,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const LangMark: React.FC<{ lang?: string; size: number; accent: string }> = ({
  lang,
  size,
  accent,
}) => {
  if (lang === "JAVA") {
    return (
      <svg width={size} height={size} viewBox="0 0 128 128">
        <ellipse cx="64" cy="96" rx="36" ry="10" fill={accent} opacity="0.85" />
        <path
          d="M64 24c8 14-8 20 0 34 10-8 22-4 22 12-18 10-44 10-56-4 6-16 22-18 34-42z"
          fill={accent}
        />
      </svg>
    );
  }
  if (lang === "JS") {
    return (
      <svg width={size} height={size} viewBox="0 0 128 128">
        <rect width="128" height="128" rx="18" fill={accent} />
        <text
          x="18"
          y="96"
          fill="#111"
          fontSize="64"
          fontFamily="Arial Black, sans-serif"
          fontWeight="800"
        >
          JS
        </text>
      </svg>
    );
  }
  if (lang === "SQL") {
    return (
      <svg width={size} height={size} viewBox="0 0 128 128">
        <ellipse cx="64" cy="28" rx="40" ry="16" fill={accent} />
        <path
          d="M24 28v52c0 12 18 22 40 22s40-10 40-22V28"
          fill="none"
          stroke={accent}
          strokeWidth="10"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 128 128">
      <path
        fill="#3776AB"
        d="M63.391 1.984c-4.222.015-8.294.281-12.32 1.016-9.308 1.703-11.002 5.281-11.002 11.859v8.703h22.559v3.313H27.805c-7.792 0-14.637 4.661-16.75 13.516-2.461 10.176-2.57 16.526 0 27.188 1.906 7.438 6.438 13.516 14.23 13.516h9.22v-12.281c0-8.875 7.656-16.656 16.75-16.656h26.203c7.455 0 13.406-6.094 13.406-13.625V15.859c0-7.266-6.156-12.844-13.406-14.234C72.375 1.43 67.62 1.96 63.39 1.984zm-13.3 8.313c2.551 0 4.634 2.117 4.634 4.703 0 2.574-2.083 4.656-4.634 4.656-2.562 0-4.656-2.082-4.656-4.656 0-2.586 2.094-4.703 4.656-4.703z"
      />
      <path
        fill="#FFD43B"
        d="M91.852 28.375v12.141c0 9.25-7.875 17.03-16.75 17.03H48.9c-7.617 0-13.406 6.348-13.406 13.625v25.359c0 7.266 6.32 11.54 13.406 13.625 8.504 2.492 16.636 2.94 26.203 0 6.359-1.945 13.406-5.859 13.406-13.625V76.25H66.005V72.938h39.199c7.792 0 10.73-5.443 13.406-13.516 2.773-8.43 2.648-16.432 0-27.188-1.883-7.617-5.598-13.516-13.406-13.516H91.852zM75.078 89.422c2.562 0 4.656 2.117 4.656 4.703 0 2.574-2.094 4.688-4.656 4.688-2.551 0-4.641-2.113-4.641-4.688 0-2.586 2.09-4.703 4.641-4.703z"
      />
    </svg>
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
