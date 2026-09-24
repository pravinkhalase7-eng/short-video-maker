import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import { looksLikeCode, parseQuizSheet, quizSeriesBadge } from "../utils";

const { fontFamily } = loadFont();
const { fontFamily: anton } = loadAnton("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const { fontFamily: outfit } = loadOutfit("normal", {
  weights: ["700", "800"],
  subsets: ["latin"],
});

const CODE_KEYWORDS =
  /\b(public|private|protected|static|void|new|return|class|function|const|let|var|if|else|elif|def|print|pass|import|from|True|False|None|null|true|false|int|string|String|list|self|this|for|while|in|not|and|or|stream|filter|forEach|map|toList|Action|run)\b/g;

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
}> = ({
  card,
  variant,
  delayFrames,
  sceneFrames,
  optionFrom,
  optionStep,
  answerLetter,
}) => {
  const frame = useCurrentFrame();
  const body = card.body.trim();
  if (!body || sceneFrames < 14) {
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
  const opacity = isQuiz
    ? interpolate(frame, [start, start + 6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
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
  const rise = interpolate(frame, [start, start + 8], [18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill
      style={{
        justifyContent: isQuiz ? "flex-start" : "center",
        alignItems: "center",
        paddingTop: isPortrait ? (isQuiz ? 108 : 80) : 40,
        paddingBottom: isPortrait ? (isQuiz ? 430 : 280) : 160,
        paddingLeft: isPortrait ? 28 : 80,
        paddingRight: isPortrait ? 28 : 80,
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
  A: "#FFD166",
  B: "#4CC9F0",
  C: "#F72585",
  D: "#7CFFB2",
};

const QuizCard: React.FC<{
  title?: string;
  body: string;
  answer?: string;
  isPortrait: boolean;
  optionFrom: number;
  optionStep: number;
}> = ({ title, body, answer, isPortrait, optionFrom, optionStep }) => {
  const frame = useCurrentFrame();
  const sheet = parseQuizSheet({ title, body, answer });
  const badge = quizSeriesBadge({ title, body });
  const revealAll = Boolean(sheet.answer);
  const optionFont = sheet.code ? (isPortrait ? 32 : 26) : isPortrait ? 38 : 30;
  const questionFont = sheet.code ? (isPortrait ? 42 : 34) : isPortrait ? 56 : 44;
  const questionText =
    sheet.question.replace(/^\d+[).]\s*/, "").trim() ||
    (sheet.code ? "What is the output?" : "");
  const options =
    sheet.options.length > 0
      ? sheet.options
      : fallbackQuizOptions(body);

  return (
    <div
      style={{
        margin: isPortrait ? "28px auto 0" : "22px auto 0",
        width: "100%",
        maxWidth: isPortrait ? 1020 : 1100,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        borderRadius: 28,
        padding: isPortrait ? "36px 22px 20px" : "32px 26px 18px",
        background:
          "linear-gradient(180deg, rgba(18, 12, 40, 0.94) 0%, rgba(8, 10, 24, 0.96) 100%)",
        border: "3px solid rgba(255, 209, 102, 0.95)",
        boxShadow:
          "0 0 0 6px rgba(247, 37, 133, 0.18), 0 24px 60px rgba(0,0,0,0.55)",
        color: "white",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translate(-50%, -50%)",
          padding: isPortrait ? "10px 26px" : "8px 20px",
          borderRadius: 999,
          backgroundColor: "rgba(8, 10, 24, 0.98)",
          border: "2px solid #FFD166",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: anton,
            fontWeight: 400,
            fontSize: isPortrait ? 28 : 22,
            letterSpacing: 2.4,
            color: "#FFD166",
            lineHeight: 1,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </p>
      </div>
      {questionText ? (
        <div
          style={{
            margin: "18px 0 28px",
            padding: isPortrait ? "16px 16px" : "12px 16px",
            flexShrink: 0,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.1)",
            border: "2px solid rgba(255,255,255,0.18)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: outfit,
              fontWeight: 800,
              fontSize: questionFont,
              lineHeight: 1.12,
              color: "white",
              textAlign: "center",
              letterSpacing: -0.6,
              textShadow: "0 4px 16px rgba(0,0,0,0.55)",
            }}
          >
            {questionText}
          </p>
        </div>
      ) : null}
      {sheet.code ? (
        <VsCodePane code={sheet.code} isPortrait={isPortrait} />
      ) : (
        <div style={{ height: isPortrait ? 28 : 20 }} />
      )}
      <div style={{ marginTop: isPortrait ? 8 : 6 }}>
      {options.map((option, index) => {
        const selected = sheet.answer === option.letter;
        const missed = Boolean(sheet.answer) && !selected;
        const color = OPTION_COLORS[option.letter] || "#FFD166";
        const appearAt = revealAll ? 0 : optionFrom + index * optionStep;
        const appear = interpolate(
          frame,
          [appearAt, appearAt + 7],
          [28, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const opacity = interpolate(
          frame,
          [appearAt, appearAt + 6],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <div
            key={`${option.letter}-${index}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 16,
              padding: isPortrait ? "14px 16px" : "12px 14px",
              borderRadius: 18,
              flexShrink: 0,
              backgroundColor: selected
                ? "rgba(124, 255, 178, 0.22)"
                : "rgba(255,255,255,0.06)",
              border: selected ? `3px solid ${color}` : "2px solid rgba(255,255,255,0.14)",
              opacity: missed ? 0.38 * opacity : opacity,
              transform: `translateX(${appear}px) scale(${selected ? 1.04 : 1})`,
            }}
          >
            <span
              style={{
                width: isPortrait ? 58 : 48,
                height: isPortrait ? 58 : 48,
                borderRadius: 16,
                backgroundColor: color,
                color: "#111",
                fontFamily: anton,
                fontWeight: 400,
                fontSize: isPortrait ? 36 : 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 6px 0 rgba(0,0,0,0.35)",
              }}
            >
              {option.letter}
            </span>
            <span
              style={{
                fontFamily: outfit,
                fontWeight: 700,
                fontSize: optionFont,
                lineHeight: 1.18,
                color: "white",
                letterSpacing: -0.2,
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

function editorTabName(code: string): string {
  if (/\bSELECT\b|\bFROM\b/i.test(code)) {
    return "query.sql";
  }
  if (/\bpublic\s+class\b|System\.out/.test(code)) {
    return "Main.java";
  }
  if (/\b(const|let|var|function|=>)\b/.test(code) && !/\bdef\s|\bprint\s*\(/.test(code)) {
    return "index.js";
  }
  if (/\bclass\s|\bdef\s|\bprint\s*\(|:\s*$/m.test(code)) {
    return "main.py";
  }
  return "snippet.txt";
}

const VsCodePane: React.FC<{ code: string; isPortrait: boolean }> = ({
  code,
  isPortrait,
}) => {
  const lines = code.split(/\r?\n/).slice(0, 8);
  const tab = editorTabName(code);
  const fontSize = isPortrait ? 28 : 22;
  return (
    <div
      style={{
        minHeight: isPortrait ? 320 : 220,
        maxHeight: isPortrait ? 520 : 360,
        margin: "0 0 36px",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#1e1e1e",
        border: "1px solid #3c3c3c",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          backgroundColor: "#323233",
          borderBottom: "1px solid #1e1e1e",
          flexShrink: 0,
        }}
      >
        <Dot color="#ff5f56" />
        <Dot color="#ffbd2e" />
        <Dot color="#27c93f" />
        <span
          style={{
            marginLeft: 10,
            padding: "4px 12px",
            borderRadius: "8px 8px 0 0",
            backgroundColor: "#1e1e1e",
            color: "#cccccc",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: isPortrait ? 18 : 16,
          }}
        >
          {tab}
        </span>
        <span
          style={{
            marginLeft: "auto",
            color: "#858585",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 14,
          }}
        >
          UTF-8
        </span>
      </div>
      <div
        style={{
          flex: 1,
          padding: isPortrait ? "22px 8px 28px 0" : "16px 8px 20px 0",
          overflow: "hidden",
        }}
      >
        {lines.map((line, index) => (
          <div
            key={`vs-line-${index}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              minHeight: fontSize * 1.45,
            }}
          >
            <span
              style={{
                width: isPortrait ? 48 : 40,
                flexShrink: 0,
                textAlign: "right",
                paddingRight: 12,
                color: "#858585",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: fontSize - 4,
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
      <span key={`${match.index}-${match[0]}`} style={{ color: "#569cd6" }}>
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
