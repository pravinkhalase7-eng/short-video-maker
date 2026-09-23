import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import { looksLikeCode } from "../utils";

const { fontFamily } = loadFont();

const CODE_KEYWORDS =
  /\b(public|private|protected|void|new|return|class|function|const|let|var|if|else|int|string|String|list|stream|filter|forEach|map|toList|Action|run)\b/g;

type Card = {
  title?: string;
  body: string;
  kind?: "code" | "fact";
};

export const ExampleCardOverlay: React.FC<{
  card: Card;
  variant: "portrait" | "landscape";
  delayFrames: number;
  sceneFrames: number;
}> = ({ card, variant, delayFrames, sceneFrames }) => {
  const frame = useCurrentFrame();
  const body = card.body.trim();
  if (!body || sceneFrames < 14) {
    return null;
  }

  const start = Math.min(
    Math.max(delayFrames, 8),
    Math.max(8, sceneFrames - 28),
  );
  const fadeOut = Math.max(start + 18, sceneFrames - 8);
  const opacity = interpolate(
    frame,
    [start, start + 6, fadeOut, Math.min(sceneFrames, fadeOut + 6)],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const rise = interpolate(frame, [start, start + 8], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const isPortrait = variant === "portrait";
  const kind = looksLikeCode(body) ? "code" : card.kind || "fact";

  return (
    <AbsoluteFill
      style={{
        justifyContent: kind === "code" ? "center" : "center",
        alignItems: "center",
        paddingTop: isPortrait ? 80 : 40,
        paddingBottom: isPortrait ? 280 : 160,
        paddingLeft: isPortrait ? 56 : 80,
        paddingRight: isPortrait ? 56 : 80,
        pointerEvents: "none",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.42) 45%, rgba(0,0,0,0.2) 100%)",
        }}
      />
      <div style={{ transform: `translateY(${rise}px)`, width: "100%" }}>
        {kind === "code" ? (
          <CodeCard
            title={card.title}
            body={body}
            isPortrait={isPortrait}
          />
        ) : (
          <FactCard title={card.title} body={body} isPortrait={isPortrait} />
        )}
      </div>
    </AbsoluteFill>
  );
};

const CodeCard: React.FC<{
  title?: string;
  body: string;
  isPortrait: boolean;
}> = ({ title, body, isPortrait }) => {
  const lines = body.split(/\r?\n/).slice(0, 6);
  const fontSize =
    lines.length > 4 ? (isPortrait ? 34 : 30) : isPortrait ? 42 : 36;

  return (
    <div
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: isPortrait ? 920 : 1100,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: "#0d1117",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "18px 24px",
          backgroundColor: "#161b22",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Dot color="#ff5f56" />
        <Dot color="#ffbd2e" />
        <Dot color="#27c93f" />
        {title ? (
          <span
            style={{
              marginLeft: 12,
              fontFamily,
              fontWeight: 800,
              fontSize: isPortrait ? 28 : 24,
              letterSpacing: 1.4,
              color: "#c9d1d9",
              textTransform: "uppercase",
            }}
          >
            {title}
          </span>
        ) : null}
      </div>
      <div style={{ padding: isPortrait ? "28px 32px 32px" : "22px 28px 26px" }}>
        {lines.map((line, index) => (
          <pre
            key={`code-line-${index}`}
            style={{
              margin: 0,
              marginBottom: 6,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize,
              lineHeight: 1.35,
              color: "#e6edf3",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            <HighlightedCode text={line.length ? line : " "} />
          </pre>
        ))}
      </div>
    </div>
  );
};

const FactCard: React.FC<{
  title?: string;
  body: string;
  isPortrait: boolean;
}> = ({ title, body, isPortrait }) => {
  return (
    <div
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: isPortrait ? 860 : 980,
        borderRadius: 36,
        padding: isPortrait ? "48px 44px" : "36px 48px",
        backgroundColor: "rgba(8, 10, 18, 0.82)",
        border: "2px solid rgba(255,255,255,0.18)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        textAlign: "center",
      }}
    >
      {title ? (
        <p
          style={{
            margin: 0,
            fontFamily,
            fontWeight: 900,
            fontSize: title.length <= 6 ? (isPortrait ? 120 : 96) : isPortrait ? 72 : 60,
            lineHeight: 0.95,
            color: "white",
            textTransform: "uppercase",
            WebkitTextStroke: "2px black",
          }}
        >
          {title}
        </p>
      ) : null}
      <p
        style={{
          margin: title ? "22px 0 0" : 0,
          fontFamily,
          fontWeight: 700,
          fontSize: isPortrait ? 42 : 34,
          lineHeight: 1.15,
          color: "rgba(255,255,255,0.92)",
          textTransform: "uppercase",
        }}
      >
        {body}
      </p>
    </div>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      width: 14,
      height: 14,
      borderRadius: 999,
      backgroundColor: color,
      display: "inline-block",
    }}
  />
);

const HighlightedCode: React.FC<{ text: string }> = ({ text }) => {
  const parts: ReactNode[] = [];
  let last = 0;
  const matcher = new RegExp(CODE_KEYWORDS.source, "g");
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(
      <span key={`${match.index}-${match[0]}`} style={{ color: "#79c0ff" }}>
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return <>{parts}</>;
};
