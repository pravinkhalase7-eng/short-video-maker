import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadRowdies } from "@remotion/google-fonts/Rowdies";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import { looksLikeCode, parseQuizSheet, quizSeriesHeadline, INSTAGRAM_REEL } from "../utils";
import { vnEnter, vnTransform } from "./VnMotion";

const { fontFamily } = loadFont();
const { fontFamily: rowdies } = loadRowdies("normal", {
  weights: ["700"],
  subsets: ["latin"],
});
const { fontFamily: nunito } = loadNunito("normal", {
  weights: ["800", "900"],
  subsets: ["latin"],
});

const CODE_TOKEN =
  /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*$|\b\d+(?:\.\d+)?\b|\b(?:public|private|protected|static|void|new|return|class|function|const|let|var|if|else|elif|def|print|pass|import|from|True|False|None|null|true|false|int|string|String|list|self|this|for|while|in|not|and|or|stream|filter|forEach|map|toList|Action|run)\b)/g;

type Card = {
  title?: string;
  body: string;
  kind?: "code" | "fact" | "quiz";
};

export const ExampleCardOverlay: React.FC<{
  card: Card;
  variant: "portrait" | "landscape";
  delayFrames: number;
  sceneFrames: number;
  optionFrom?: number;
  optionStep?: number;
  answerLetter?: string;
  poster?: boolean;
}> = ({
  card,
  variant,
  delayFrames,
  sceneFrames,
  optionFrom,
  optionStep,
  answerLetter,
  poster,
}) => {
  const frame = useCurrentFrame();
  const body = card.body.trim();
  if (!body || (!poster && sceneFrames < 14)) {
    return null;
  }

  const kind =
    card.kind === "quiz"
      ? "quiz"
      : looksLikeCode(body)
        ? "code"
        : card.kind || "fact";
  const isQuiz = kind === "quiz";
  const start = isQuiz
    ? Math.max(0, delayFrames)
    : Math.min(
        Math.max(delayFrames, 8),
        Math.max(8, sceneFrames - 28),
      );
  const opacity = poster
    ? 1
    : isQuiz
      ? 1
      : interpolate(
          frame,
          strictlyIncreasing([
            start,
            start + 6,
            Math.max(start + 18, sceneFrames - 8),
            Math.min(sceneFrames, Math.max(start + 24, sceneFrames - 2)),
          ]),
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        );
  const rise = poster || isQuiz
    ? 0
    : interpolate(frame, [start, start + 8], [18, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill
      style={{
        justifyContent: isQuiz ? "flex-start" : "center",
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        paddingTop: isPortrait
          ? isQuiz
            ? INSTAGRAM_REEL.safeTop
            : 80
          : 40,
        paddingBottom: isPortrait
          ? isQuiz
            ? INSTAGRAM_REEL.safeBottom
            : 280
          : 160,
        paddingLeft: isPortrait
          ? isQuiz
            ? INSTAGRAM_REEL.safeLeft
            : INSTAGRAM_REEL.safeX
          : 80,
        paddingRight: isPortrait
          ? isQuiz
            ? INSTAGRAM_REEL.safeRight
            : INSTAGRAM_REEL.safeX
          : 80,
        pointerEvents: "none",
        opacity,
      }}
    >
      {isQuiz ? null : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.42) 45%, rgba(0,0,0,0.2) 100%)",
          }}
        />
      )}
      <div
        style={{
          transform: `translateY(${rise}px)`,
          width: "100%",
          display: isQuiz ? "flex" : undefined,
          flexDirection: isQuiz ? "column" : undefined,
        }}
      >
        {kind === "code" ? (
          <CodeCard
            title={card.title}
            body={body}
            isPortrait={isPortrait}
          />
        ) : kind === "quiz" ? (
          <QuizCard
            title={card.title}
            body={body}
            answer={answerLetter}
            isPortrait={isPortrait}
            optionFrom={optionFrom ?? start + 10}
            optionStep={optionStep ?? 18}
            poster={poster}
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

const OPTION_COLORS: Record<string, string> = {
  A: "#5EC8F0",
  B: "#F0C419",
  C: "#5EC8F0",
  D: "#3D7EFF",
};

const QuizCard: React.FC<{
  title?: string;
  body: string;
  answer?: string;
  isPortrait: boolean;
  optionFrom: number;
  optionStep: number;
  poster?: boolean;
}> = ({ title, body, answer, isPortrait, optionFrom, optionStep, poster }) => {
  const frame = useCurrentFrame();
  const sheet = parseQuizSheet({ title, body, answer });
  const headline = quizSeriesHeadline({ title, body });
  const revealAll = Boolean(poster) || Boolean(sheet.answer);
  const optionFont = sheet.code ? (isPortrait ? 52 : 38) : isPortrait ? 56 : 42;
  const questionFont = sheet.code ? (isPortrait ? 42 : 32) : isPortrait ? 50 : 38;
  const questionText =
    sheet.question.replace(/^\d+[).]\s*/, "").trim() ||
    (sheet.code ? "What is the output?" : "");
  const options =
    sheet.options.length > 0
      ? sheet.options
      : fallbackQuizOptions(body);
  const titleMotion = vnEnter(frame, 0, {
    duration: 11,
    fromY: -160,
    fromScale: 1.32,
    poster,
  });
  const codeMotion = vnEnter(frame, 6, {
    duration: 12,
    fromY: 90,
    fromScale: 0.9,
    poster,
  });
  const questionMotion = vnEnter(frame, 10, {
    duration: 10,
    fromY: 36,
    poster,
  });

  return (
    <div
      style={{
        margin: 0,
        width: "100%",
        maxWidth: isPortrait ? 968 : 1100,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        color: "white",
      }}
    >
      <p
        style={{
          margin: 0,
          marginBottom: isPortrait ? 36 : 24,
          flexShrink: 0,
          fontFamily: rowdies,
          fontWeight: 700,
          fontSize: isPortrait ? 64 : 50,
          letterSpacing: 0.2,
          lineHeight: 1,
          textAlign: "center",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          WebkitTextStroke: isPortrait ? "4px #0b1220" : "3px #0b1220",
          paintOrder: "stroke fill",
          textShadow: "0 6px 0 #071018, 0 12px 18px rgba(0,0,0,0.45)",
          opacity: titleMotion.opacity,
          transform: vnTransform(titleMotion),
        }}
      >
        <span style={{ color: "#62B3F0" }}>{headline.lang}</span>
        {" "}
        <span style={{ color: "#F0C419" }}>{headline.rest}</span>
      </p>
      {sheet.code ? (
        <div
          style={{
            flexShrink: 0,
            marginBottom: isPortrait ? 36 : 24,
            opacity: codeMotion.opacity,
            transform: vnTransform(codeMotion),
          }}
        >
          <MacCodeWindow code={sheet.code} isPortrait={isPortrait} />
        </div>
      ) : null}
      {questionText ? (
        <p
          style={{
            margin: 0,
            marginBottom: isPortrait ? 36 : 24,
            flexShrink: 0,
            fontFamily: nunito,
            fontWeight: 800,
            fontSize: questionFont,
            lineHeight: 1.25,
            color: "white",
            textAlign: "center",
            letterSpacing: -0.3,
            textShadow: "0 3px 0 #0b1220, 0 8px 16px rgba(0,0,0,0.45)",
            opacity: questionMotion.opacity,
            transform: vnTransform(questionMotion),
          }}
        >
          {questionText}
        </p>
      ) : null}
      <div
        style={{
          paddingLeft: isPortrait ? 20 : 12,
          paddingBottom: 0,
          flexShrink: 0,
        }}
      >
        {options.map((option, index) => {
          const selected = Boolean(sheet.answer) && sheet.answer === option.letter;
          const missed = Boolean(sheet.answer) && !selected;
          const color = OPTION_COLORS[option.letter] || "#5EC8F0";
          const appearAt = revealAll ? 0 : optionFrom + index * optionStep;
          const motion = vnEnter(frame, appearAt, {
            duration: 10,
            fromX: 120,
            fromScale: 0.92,
            poster,
          });
          const punch = selected
            ? interpolate(frame, [0, 10], [1.12, 1.05], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : 1;
          return (
            <div
              key={`${option.letter}-${index}`}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 14,
                marginBottom: isPortrait ? 28 : 18,
                opacity: missed ? 0.38 * motion.opacity : motion.opacity,
                transform: `${vnTransform(motion)} scale(${punch})`,
              }}
            >
              <span
                style={{
                  fontFamily: nunito,
                  fontWeight: 800,
                  fontSize: optionFont,
                  lineHeight: 1.15,
                  color,
                  letterSpacing: -0.4,
                  textShadow: selected
                    ? `0 0 18px ${color}`
                    : "0 4px 12px rgba(0,0,0,0.45)",
                  flexShrink: 0,
                }}
              >
                {option.letter})
              </span>
              <span
                style={{
                  fontFamily: nunito,
                  fontWeight: 700,
                  fontSize: optionFont,
                  lineHeight: 1.18,
                  color: "white",
                  letterSpacing: -0.2,
                  textShadow: "0 4px 12px rgba(0,0,0,0.45)",
                }}
              >
                {option.text}
                {selected ? "  ✓" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function strictlyIncreasing(values: number[]): number[] {
  const result: number[] = [];
  for (const value of values) {
    result.push(
      result.length === 0 ? value : Math.max(value, result[result.length - 1] + 1),
    );
  }
  return result;
}

function fallbackQuizOptions(body: string): { letter: string; text: string }[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^([A-D])(?:[)\]:\-]|\.)\s+(.+)$/i))
    .flatMap((match) =>
      match && !/^[A-Za-z_]\w*\.[A-Za-z_]\w*\s*=/.test(match[0])
        ? [{ letter: match[1].toUpperCase(), text: match[2].trim() }]
        : [],
    );
}

const MacCodeWindow: React.FC<{
  code: string;
  isPortrait: boolean;
}> = ({ code, isPortrait }) => {
  return (
    <VsCodeSnippetWindow code={code} isPortrait={isPortrait} maxLines={8} />
  );
};

export const VsCodeSnippetWindow: React.FC<{
  code: string;
  filename?: string;
  isPortrait: boolean;
  maxLines?: number;
}> = ({ code, filename, isPortrait, maxLines = 16 }) => {
  const lines = code.split(/\r?\n/).slice(0, maxLines);
  const tab = filename || "main.py";
  const fontSize =
    lines.length > 12
      ? isPortrait
        ? 26
        : 20
      : lines.length > 8
        ? isPortrait
          ? 30
          : 22
        : lines.length > 5
          ? isPortrait
            ? 34
            : 24
          : isPortrait
            ? 40
            : 30;
  const gutter = isPortrait ? 56 : 46;
  return (
    <div
      style={{
        margin: "0 auto",
        width: "100%",
        maxWidth: isPortrait ? 960 : 980,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#1e1e1e",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 28px 64px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: isPortrait ? "12px 16px" : "10px 14px",
          backgroundColor: "#3c3c3c",
        }}
      >
        <Dot color="#ff5f56" />
        <Dot color="#ffbd2e" />
        <Dot color="#27c93f" />
        <span
          style={{
            marginLeft: 8,
            flex: 1,
            fontFamily: nunito,
            fontWeight: 800,
            fontSize: isPortrait ? 18 : 15,
            color: "#d4d4d4",
            letterSpacing: 0.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tab} — Visual Studio Code
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          backgroundColor: "#252526",
          borderBottom: "1px solid #1e1e1e",
          paddingLeft: 12,
        }}
      >
        <div
          style={{
            padding: isPortrait ? "10px 18px 8px" : "8px 14px 6px",
            backgroundColor: "#1e1e1e",
            borderTop: "2px solid #007acc",
            fontFamily: nunito,
            fontWeight: 800,
            fontSize: isPortrait ? 16 : 13,
            color: "#cccccc",
          }}
        >
          {tab}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          backgroundColor: "#1e1e1e",
          padding: isPortrait ? "18px 20px 28px 8px" : "12px 14px 20px 6px",
          minHeight: isPortrait ? 420 : 280,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {lines.map((line, index) => (
            <div
              key={`vscode-line-${index}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                minHeight: fontSize * 1.45,
              }}
            >
              <span
                style={{
                  width: gutter,
                  flexShrink: 0,
                  textAlign: "right",
                  paddingRight: 16,
                  color: "#858585",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  fontSize: fontSize - 2,
                  lineHeight: 1.45,
                }}
              >
                {index + 1}
              </span>
              <pre
                style={{
                  margin: 0,
                  flex: 1,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                  fontSize,
                  lineHeight: 1.45,
                  color: "#d4d4d4",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <HighlightedCode text={line.length ? line : " "} />
              </pre>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isPortrait ? "8px 16px" : "6px 12px",
          backgroundColor: "#007acc",
          fontFamily: nunito,
          fontWeight: 800,
          fontSize: isPortrait ? 14 : 12,
          color: "white",
          letterSpacing: 0.3,
        }}
      >
        <span>{tab.endsWith(".java") ? "Java" : tab.endsWith(".js") ? "JavaScript" : "Python"}</span>
        <span>{`UTF-8  Ln ${lines.length}, Col 1`}</span>
      </div>
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
  const matcher = new RegExp(CODE_TOKEN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    const color = token.startsWith("#")
      ? "#6a9955"
      : token.startsWith('"') || token.startsWith("'")
        ? "#ce9178"
        : /^\d/.test(token)
          ? "#F5D76E"
          : "#5BA3E8";
    parts.push(
      <span key={`${match.index}-${token}`} style={{ color }}>
        {token}
      </span>,
    );
    last = match.index + token.length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return <>{parts}</>;
};
