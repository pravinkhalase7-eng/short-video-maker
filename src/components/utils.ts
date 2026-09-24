import { z } from "zod";
import {
  type Caption,
  type CaptionPage,
  type CaptionLine,
  type OrientationEnum,
  MusicVolumeEnum,
} from "../types/shorts";
import { AvailableComponentsEnum, type OrientationConfig } from "./types";

export const shortVideoSchema = z.object({
  scenes: z.array(
    z.object({
      captions: z.custom<Caption[]>(),
      audio: z.object({
        url: z.string(),
        duration: z.number(),
      }),
      video: z.string(),
      clips: z
        .array(
          z.object({
            url: z.string(),
            kind: z.enum(["video", "image"]).optional(),
          }),
        )
        .optional(),
      overlayText: z.string().optional(),
      exampleCard: z
        .object({
          title: z.string().optional(),
          body: z.string(),
          kind: z.enum(["code", "fact", "quiz"]).optional(),
        })
        .optional(),
      kind: z.enum(["video", "image"]).optional(),
      holdMs: z.number().optional(),
    }),
  ),
  config: z.object({
    paddingBack: z.number().optional(),
    captionPosition: z.enum(["top", "center", "bottom"]).optional(),
    captionBackgroundColor: z.string().optional(),
    durationMs: z.number(),
    musicVolume: z.nativeEnum(MusicVolumeEnum).optional(),
    hookText: z.string().optional(),
    hookDurationMs: z.number().optional(),
    endCardText: z.string().optional(),
    endCardCta: z.string().optional(),
    endCardBeats: z.array(z.string()).max(3).optional(),
    format: z.enum(["story", "quiz"]).optional(),
    sfx: z
      .object({
        whoosh: z.string(),
        pop: z.string(),
        click: z.string(),
        sting: z.string(),
        beep: z.string().optional(),
        clap: z.string().optional(),
        correct: z.string().optional(),
        tick: z.string().optional(),
        count: z.string().optional(),
      })
      .optional(),
  }),
  music: z.object({
    file: z.string(),
    url: z.string(),
    start: z.number(),
    end: z.number(),
  }),
});

export function createCaptionPages({
  captions,
  lineMaxLength,
  lineCount,
  maxDistanceMs,
}: {
  captions: Caption[];
  lineMaxLength: number;
  lineCount: number;
  maxDistanceMs: number;
}) {
  const pages = [];
  let currentPage: CaptionPage = {
    startMs: 0,
    endMs: 0,
    lines: [],
  };
  let currentLine: CaptionLine = {
    texts: [],
  };

  captions.forEach((caption, i) => {
    // Check if we need to start a new page due to time gap
    if (i > 0 && caption.startMs - currentPage.endMs > maxDistanceMs) {
      // Add current line if not empty
      if (currentLine.texts.length > 0) {
        currentPage.lines.push(currentLine);
      }
      // Add current page if not empty
      if (currentPage.lines.length > 0) {
        pages.push(currentPage);
      }
      // Start new page
      currentPage = {
        startMs: caption.startMs,
        endMs: caption.endMs,
        lines: [],
      };
      currentLine = {
        texts: [],
      };
    }

    // Check if adding this caption exceeds the line length
    const currentLineText = currentLine.texts.map((t) => t.text).join(" ");
    if (
      currentLine.texts.length > 0 &&
      currentLineText.length + 1 + caption.text.length > lineMaxLength
    ) {
      // Line is full, add it to current page
      currentPage.lines.push(currentLine);
      currentLine = {
        texts: [],
      };

      // Check if page is full
      if (currentPage.lines.length >= lineCount) {
        // Page is full, add it to pages
        pages.push(currentPage);
        // Start new page
        currentPage = {
          startMs: caption.startMs,
          endMs: caption.endMs,
          lines: [],
        };
      }
    }

    // Add caption to current line
    currentLine.texts.push({
      text: caption.text,
      startMs: caption.startMs,
      endMs: caption.endMs,
    });

    // Update page timing
    currentPage.endMs = caption.endMs;
    if (i === 0 || currentPage.startMs === 0) {
      currentPage.startMs = caption.startMs;
    } else {
      currentPage.startMs = Math.min(currentPage.startMs, caption.startMs);
    }
  });

  // Don't forget to add the last line and page
  if (currentLine.texts.length > 0) {
    currentPage.lines.push(currentLine);
  }
  if (currentPage.lines.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export function getOrientationConfig(orientation: OrientationEnum) {
  const config: Record<OrientationEnum, OrientationConfig> = {
    portrait: {
      width: 1080,
      height: 1920,
      component: AvailableComponentsEnum.PortraitVideo,
    },
    landscape: {
      width: 1920,
      height: 1080,
      component: AvailableComponentsEnum.LandscapeVideo,
    },
  };

  return config[orientation];
}

export function getSceneSequence({
  scenes,
  index,
  fps,
  hookFrames = 0,
}: {
  scenes: { audio: { duration: number } }[];
  index: number;
  fps: number;
  hookFrames?: number;
}): { startFrame: number; durationInFrames: number } {
  const hookExtra = Math.max(0, hookFrames);
  const spokenBefore = scenes
    .slice(0, index)
    .reduce((acc, scene) => acc + scene.audio.duration, 0);
  const startFrame = Math.round(spokenBefore * fps) + (index === 0 ? 0 : hookExtra);
  const spokenFrames = Math.max(
    1,
    Math.round(scenes[index].audio.duration * fps),
  );
  const durationInFrames =
    index === 0 ? spokenFrames + hookExtra : spokenFrames;
  return { startFrame, durationInFrames };
}

export function usesHardcodedWorksheet(
  config?: { format?: string },
  scenes?: { exampleCard?: { kind?: string } }[],
): boolean {
  return (
    config?.format === "quiz" ||
    Boolean(scenes?.some((scene) => scene.exampleCard?.kind === "quiz"))
  );
}

export function clipCountForDuration(seconds: number): number {
  if (seconds >= 6) {
    return 3;
  }
  if (seconds >= 3) {
    return 2;
  }
  return 1;
}

export function splitClipWindows(
  durationInFrames: number,
  clipCount: number,
): { from: number; durationInFrames: number }[] {
  const total = Math.max(1, durationInFrames);
  const n = Math.max(1, Math.min(Math.max(1, clipCount), total));
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const windows: { from: number; durationInFrames: number }[] = [];
  let from = 0;
  for (let i = 0; i < n; i += 1) {
    const length = Math.max(1, base + (i < remainder ? 1 : 0));
    windows.push({ from, durationInFrames: length });
    from += length;
  }
  return windows;
}

export function sceneClips(scene: {
  video: string;
  kind?: "video" | "image";
  clips?: { url: string; kind?: "video" | "image" }[];
}): { url: string; kind?: "video" | "image" }[] {
  if (scene.clips && scene.clips.length > 0) {
    return scene.clips;
  }
  return [{ url: scene.video, kind: scene.kind }];
}

export type QuizSheetOption = {
  letter: string;
  text: string;
};

export type QuizSheet = {
  heading: string;
  question: string;
  code?: string;
  options: QuizSheetOption[];
  answer: string | null;
};

const QUIZ_OPTION_LINE = /^([A-D])(?:[)\]:\-]|\.)\s+(.+)$/i;

export function parseQuizSheet(card: {
  title?: string;
  body: string;
  answer?: string | null;
}): QuizSheet {
  const lines = card.body.split(/\r?\n/);
  const options: QuizSheetOption[] = [];
  const other: string[] = [];
  const codeLines: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(QUIZ_OPTION_LINE);
    if (match && !looksLikeAttributeAssignment(trimmed)) {
      options.push({
        letter: match[1].toUpperCase(),
        text: match[2].trim(),
      });
      continue;
    }
    const cleaned = trimmed.replace(/^\d+[).]\s*/, "").trim();
    if (looksLikeCodeLine(cleaned)) {
      codeLines.push(raw.replace(/\s+$/, ""));
      continue;
    }
    other.push(cleaned);
  }

  const uniqueOptions = new Map<string, QuizSheetOption>();
  for (const option of options) {
    uniqueOptions.set(option.letter, option);
  }

  const answerFromTitle = /^[A-D]$/i.test(card.title || "")
    ? (card.title || "").toUpperCase()
    : null;
  const answerFromField = /^[A-D]$/i.test(card.answer || "")
    ? (card.answer || "").toUpperCase()
    : null;
  const answer = answerFromTitle || answerFromField || null;
  let heading = card.title?.trim() || "Quiz";
  let questionParts = other;
  if (answer) {
    heading = "Quiz";
  }
  if (other.length >= 2 && other[0].length <= 28 && !/\?$/.test(other[0])) {
    heading = other[0];
    questionParts = other.slice(1);
  } else if (!answer && card.title?.trim()) {
    heading = card.title.trim();
  }

  if (codeLines.length > 0) {
    const asked = questionParts.filter(
      (part) => /\?$/.test(part) || /^(what|which|who|why|how)\b/i.test(part),
    );
    const leaked = questionParts.filter((part) => !asked.includes(part));
    if (leaked.length > 0) {
      codeLines.push(...leaked);
    }
    questionParts = asked;
  }

  const question =
    questionParts.join(" ").trim() ||
    (codeLines.length > 0 ? "What is the output?" : "");

  return {
    heading,
    question,
    code: codeLines.length > 0 ? codeLines.join("\n") : undefined,
    options: Array.from(uniqueOptions.values()).sort((left, right) =>
      left.letter.localeCompare(right.letter),
    ),
    answer,
  };
}

export function parsePastedQuiz(text: string): QuizSheet | null {
  const body = text.replace(/```(?:\w+)?/g, "").trim();
  if (body.length < 12) {
    return null;
  }
  const optionHits = body.match(/^(?:[A-D])(?:[)\]:\-]|\.)\s+\S/gim) || [];
  if (optionHits.length < 2) {
    return null;
  }
  const sheet = parseQuizSheet({ title: "Quiz", body });
  if (sheet.options.length < 2) {
    return null;
  }
  if (!sheet.question && !sheet.code) {
    return null;
  }
  return sheet;
}

export function isQuizAnswerCard(
  card?: {
    title?: string;
    kind?: string;
  },
  overlayText?: string,
): boolean {
  if (card?.kind !== "quiz") {
    return false;
  }
  return (
    /^[A-D]$/i.test(card.title || "") || /^[A-D]$/i.test(overlayText || "")
  );
}

export function isQuizQuestionCard(
  card?: {
    title?: string;
    kind?: string;
  },
  overlayText?: string,
): boolean {
  return card?.kind === "quiz" && !isQuizAnswerCard(card, overlayText);
}

export function quizSeriesBadge(card?: {
  title?: string;
  body?: string;
}): string {
  const raw = (card?.title || "").trim();
  const title = /^[A-D]$/i.test(raw)
    ? ""
    : raw.replace(/\s*quiz$/i, "").trim();
  const blob = `${title}\n${card?.body || ""}`;
  return quizSeriesLang(blob) || (title || "QUIZ").slice(0, 14).toUpperCase();
}

function quizSeriesLang(text: string): string | null {
  if (/\bpython\b|\bdef\s|\bprint\s*\(|\blambda\b|\bdict\b/i.test(text)) {
    return "PYTHON";
  }
  if (/\bjava\b|system\.out|\bpredicate\b|\bstream\b/i.test(text)) {
    return "JAVA";
  }
  if (/\bjavascript\b|console\.log|\bconst\s|=>/i.test(text)) {
    return "JS";
  }
  if (/\bsql\b|\bselect\b|\bfrom\b/i.test(text)) {
    return "SQL";
  }
  return null;
}

export function quizOptionReveal({
  fps,
  delayFrames = 0,
}: {
  fps: number;
  delayFrames?: number;
}): { from: number; step: number } {
  return {
    from: Math.max(0, delayFrames) + Math.max(10, Math.round(0.4 * fps)),
    step: Math.max(18, Math.round(0.75 * fps)),
  };
}

export function quizCardTitle(card?: { title?: string }): string {
  const title = (card?.title || "").trim();
  if (!title || /^[A-D]$/i.test(title)) {
    return "";
  }
  return title;
}

export function quizCountdownTiming({
  fps,
  optionFrom,
  optionStep,
  optionCount,
  sceneFrames,
  audioDelayFrames = 0,
}: {
  fps: number;
  optionFrom: number;
  optionStep: number;
  optionCount: number;
  sceneFrames: number;
  audioDelayFrames?: number;
}): {
  guessFrom: number;
  guessDuration: number;
  tickFrom: number;
  tickDuration: number;
  from: number;
  durationInFrames: number;
  step: number;
} {
  const step = Math.max(1, Math.round(fps));
  const lastOption =
    optionCount > 0
      ? optionFrom + Math.max(0, optionCount - 1) * optionStep
      : optionFrom;
  const afterOptions = Math.max(
    audioDelayFrames,
    lastOption + Math.round(0.2 * fps),
  );
  const thinkLen = step * 8;
  const countLen = step * 3;
  const from = Math.max(afterOptions + thinkLen, sceneFrames - countLen);
  return {
    guessFrom: afterOptions,
    guessDuration: Math.max(0, from - afterOptions),
    tickFrom: afterOptions,
    tickDuration: 0,
    from,
    durationInFrames: Math.max(0, sceneFrames - from),
    step,
  };
}

export function isPunchCaptionWord(text: string): boolean {
  const token = text.replace(/[^\w%]/g, "");
  if (!token) {
    return false;
  }
  if (/\d/.test(token)) {
    return true;
  }
  return token.length >= 7;
}

export function captionsFromSpeech(
  text: string,
  durationSec: number,
  speechWindow?: { startSec: number; endSec: number } | null,
): Caption[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const spokenMs = Math.max(400, durationSec * 1000);
  if (words.length === 0) {
    return [{ text: " ", startMs: 0, endMs: spokenMs }];
  }
  const fallbackOnset = Math.min(220, spokenMs * 0.08);
  const fallbackTail = Math.min(280, spokenMs * 0.1);
  const onsetMs = speechWindow
    ? Math.max(0, Math.min(spokenMs * 0.45, speechWindow.startSec * 1000))
    : fallbackOnset;
  const closeMs = speechWindow
    ? Math.max(onsetMs + 200, Math.min(spokenMs, speechWindow.endSec * 1000))
    : Math.max(onsetMs + 200, spokenMs - fallbackTail);
  const usable = Math.max(200, closeMs - onsetMs);
  const weights = words.map((word) => wordSpeechWeight(word));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = onsetMs;
  return words.map((word, index) => {
    const span = (weights[index] / total) * usable;
    const startMs = Math.round(cursor);
    cursor += span;
    return {
      text: word,
      startMs,
      endMs:
        index === words.length - 1
          ? speechWindow
            ? Math.round(closeMs)
            : spokenMs
          : Math.round(cursor),
    };
  });
}

function wordSpeechWeight(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z0-9%']/g, "");
  const letters = Math.max(1, clean.length);
  const syllables = Math.max(1, (clean.match(/[aeiouy]+/g) || []).length);
  let weight = 0.28 + syllables * 0.52 + Math.min(letters, 12) * 0.07;
  if (/[.,!?;:]$/.test(word)) {
    weight += 0.55;
  }
  if (letters <= 2) {
    weight *= 0.72;
  }
  return weight;
}

export function stretchSceneDurations(
  durations: number[],
  targetTotalSec: number,
  hookSec = 0,
): number[] {
  if (durations.length === 0) {
    return durations;
  }
  const spoken = durations.reduce((sum, value) => sum + value, 0);
  const extra = targetTotalSec - hookSec - spoken;
  if (extra <= 0.2) {
    return durations;
  }
  const share = extra / durations.length;
  return durations.map((value) => value + share);
}

export function getOverlayTiming({
  durationMs,
  paddingBack = 0,
  hookDurationMs = 2200,
  fps,
}: {
  durationMs: number;
  paddingBack?: number;
  hookDurationMs?: number;
  fps: number;
}): { hookFrames: number; endCardFrom: number; endCardFrames: number } {
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const endCardFrames = Math.min(
    totalFrames,
    Math.max(0, Math.round((Math.max(0, paddingBack) / 1000) * fps)),
  );
  const remaining = Math.max(0, totalFrames - endCardFrames);
  const hookFrames = Math.min(
    remaining,
    Math.max(0, Math.round((Math.max(0, hookDurationMs) / 1000) * fps)),
  );
  return {
    hookFrames,
    endCardFrom: totalFrames - endCardFrames,
    endCardFrames,
  };
}

export function looksLikeCode(text: string): boolean {
  return /[{};=>]|::|->|function\s|\bclass\s|\bpublic\s|\bconst\s|\blet\s|\bvar\s|\bdef\s|\breturn\b|\byield\b|\bprint\s*\(|\bpass\b|\.\w+\(|\.\w+\s*=|<\w+>|Stream</.test(
    text,
  );
}

export function looksLikeCodeLine(line: string): boolean {
  const text = line.trim();
  if (!text || text.length > 80) {
    return looksLikeCode(text);
  }
  if (/\?$/.test(text)) {
    return false;
  }
  return looksLikeCode(text) || looksLikeAttributeAssignment(text);
}

export function quizCaptionExplanation(sheet: QuizSheet): string {
  const parts = quizExplainParts(sheet);
  return `${parts.lead}${parts.why}`.trim();
}

export function quizInstagramExplanation(sheet: QuizSheet): string {
  const parts = quizExplainParts(sheet);
  return `${parts.lead}${parts.why}${parts.trap ? ` ${parts.trap}` : ""}`.trim();
}

function quizExplainParts(sheet: QuizSheet): {
  lead: string;
  why: string;
  trap: string;
} {
  const winning = sheet.options.find((option) => option.letter === sheet.answer);
  const win = (winning?.text || "that output").replace(/\s+/g, " ").trim();
  const code = sheet.code || "";
  return {
    lead: sheet.answer ? `The answer is ${sheet.answer}. ` : "",
    why: explainQuizWhy(code, win, sheet),
    trap: explainQuizTrap(code, sheet, win),
  };
}

function explainQuizWhy(code: string, win: string, _sheet: QuizSheet): string {
  const printed = printedExpression(code);
  const usesSets = /=\s*\{[^{}=]+\}/.test(code);
  if (/=\s*\[\s*\]/.test(code) && /\.append\(/.test(code)) {
    return `Default list arguments are created once when the function is defined, not on every call. Each append keeps growing that same list, so later calls print ${win}.`;
  }
  if (/^\w+\s*=\s*\w+\s*$/m.test(code) && /\.append\(/.test(code)) {
    return `Assignment copies the reference, not a new list. Both names point to the same object, so append changes it for both and the print is ${win}.`;
  }
  if (/\.get\(/.test(code)) {
    return `.get(key, default) returns the default when the key is missing, instead of raising KeyError. That is why this snippet prints ${win}.`;
  }
  if (/\bis\b/.test(code) && /==/.test(code)) {
    return `== compares values, so the list contents match. is compares object identity, so a new [1, 2, 3] literal is not the same object as x. Together that prints ${win}.`;
  }
  if (/\bis\b/.test(code)) {
    return `is compares object identity, not value equality. A new literal on the right is a different object, so the print is ${win}.`;
  }
  if (usesSets && /intersection\s*\(|\w+\s*&\s*\w+/.test(code)) {
    return `& is set intersection: it keeps only values that appear in both sets. The only overlap here is what you see in ${win}.`;
  }
  if (usesSets && /union\s*\(|\w+\s*\|\s*\w+/.test(code)) {
    return `| is set union: it keeps every unique value from either set, which prints ${win}.`;
  }
  if (usesSets && /symmetric_difference\s*\(|\w+\s*\^\s*\w+/.test(code)) {
    return `^ is symmetric difference: values in one set or the other, but not both. That prints ${win}.`;
  }
  if (usesSets && /difference\s*\(|\w+\s*-\s*\w+/.test(code)) {
    return `- is set difference: values in the left set that are not in the right set. That prints ${win}.`;
  }
  if (/\*\*.*\*\*/.test(code) || /\d+\s*\*\*\s*\d+\s*\*\*\s*\d+/.test(code)) {
    return `** is right-associative, so 2 ** 3 ** 2 is 2 ** (3 ** 2) = 2 ** 9, not (2 ** 3) ** 2. The print is ${win}.`;
  }
  if (isListRepeat(code)) {
    return `* on a list repeats the whole list. It does not multiply each number. [1, 2, 3] * 2 is [1, 2, 3] twice, so the print is ${win}.`;
  }
  if (/\*\s*\d+/.test(code) && /["']/.test(code)) {
    return `Multiplying a string by an integer repeats it. That is why the snippet prints ${win}.`;
  }
  if (/\/\//.test(code)) {
    return `// is floor division, so the result is rounded down to an integer. The snippet prints ${win}.`;
  }
  if (/\bbool\s*\(/.test(code) || /\bnot\s+/.test(code)) {
    return `Empty containers are falsy in Python, so this boolean check prints ${win}.`;
  }
  if (/\[::-1\]/.test(code)) {
    return `[::-1] reads the value backwards, start to finish. That reverse is ${win}.`;
  }
  if (/\bfor\b.+\bin\b/.test(code) && /%\s*2/.test(code)) {
    const keepEvens = /%\s*2\s*==\s*0/.test(code) || /not\s+\w+\s*%\s*2/.test(code);
    if (keepEvens) {
      return `i % 2 == 0 is true only for even numbers. range(5) is 0, 1, 2, 3, 4, so the list keeps 0, 2, and 4. That's ${win}.`;
    }
    return `i % 2 is 0 for even numbers (false, so they are dropped) and 1 for odd numbers (true, so they are kept). range(5) is 0, 1, 2, 3, 4, so only 1 and 3 stay. That's ${win}.`;
  }
  if (/\[[^\]]*for\s+\w+\s+in/.test(code) && /\bif\b/.test(code)) {
    return `This list comprehension keeps only values where the if is true. Those values are ${win}.`;
  }
  if (printed) {
    return `The printed expression is ${printed}, and that comes out as ${win}.`;
  }
  return `The snippet prints ${win}.`;
}

function explainQuizTrap(code: string, sheet: QuizSheet, win: string): string {
  const others = sheet.options.filter(
    (option) => option.letter !== sheet.answer && option.text.trim(),
  );
  if (others.length === 0) {
    return "";
  }
  const usesSets = /=\s*\{[^{}=]+\}/.test(code);
  if (usesSets && /intersection\s*\(|\w+\s*&\s*\w+/.test(code)) {
    const digitCount = (text: string) => (text.match(/\d+/g) || []).length;
    const unionOpt = others.find((option) => digitCount(option.text) >= 4);
    const diffs = others.filter(
      (option) =>
        option.letter !== unionOpt?.letter && digitCount(option.text) <= 2,
    );
    const parts: string[] = [];
    if (unionOpt) {
      parts.push(`${unionOpt.letter} is union (\`|\`)`);
    }
    if (diffs[0]) {
      parts.push(`${diffs[0].letter} is x − y`);
    }
    if (diffs[1]) {
      parts.push(`${diffs[1].letter} is y − x`);
    }
    if (parts.length) {
      return `${parts.join(". ")}. Those are the usual traps next to intersection.`;
    }
    return `The other options are nearby set operations: union (\`|\`) and difference (\`-\`), not intersection.`;
  }
  if (/\*\*.*\*\*/.test(code) || /\d+\s*\*\*\s*\d+\s*\*\*\s*\d+/.test(code)) {
    const leftAssoc = others.find((option) => option.text.replace(/\s/g, "") === "64");
    if (leftAssoc) {
      return `${leftAssoc.letter} is the trap if you compute left to right: (2 ** 3) ** 2 = 64.`;
    }
    return `The usual trap is grouping left to right, which is not how ** works.`;
  }
  if (isListRepeat(code)) {
    return `The trap is thinking * multiplies each number in the list. It only repeats the list.`;
  }
  if (/\bis\b/.test(code)) {
    return `If you treated is like ==, you would pick the option where both checks are True.`;
  }
  if (/=\s*\[\s*\]/.test(code) && /\.append\(/.test(code)) {
    return `The trap is thinking each call gets a fresh list, which would print [1] twice.`;
  }
  if (/\[::-1\]/.test(code)) {
    const original = others.find((option) => !/reverse|nohty/i.test(option.text) && option.text.length > 2);
    if (original) {
      return `${original.letter} is the original string, with no reverse.`;
    }
    return `The trap is thinking [::-1] leaves the string unchanged.`;
  }
  if (/\bfor\b.+\bin\b/.test(code) && /%\s*2/.test(code)) {
    const keepEvens = /%\s*2\s*==\s*0/.test(code);
    const evens = others.find((option) => /0,\s*2,\s*4/.test(option.text));
    const full = others.find((option) => /0,\s*1,\s*2,\s*3,\s*4/.test(option.text));
    const parts: string[] = [];
    if (!keepEvens && evens) {
      parts.push(`${evens.letter} is the even numbers, which would need if i % 2 == 0`);
    }
    if (full) {
      parts.push(`${full.letter} is every number from range(5), with no if filter`);
    }
    if (parts.length) {
      return `${parts.join(". ")}.`;
    }
  }
  const sample = others
    .slice(0, 2)
    .map((option) => `${option.letter} (${option.text.replace(/\s+/g, " ").trim()})`)
    .join(" and ");
  return `Easy mix-up: ${sample}. Those would need a different condition.`;
}

function printedExpression(code: string): string | null {
  const match = code.match(/print\s*\((.+)\)\s*$/m);
  const expr = match?.[1]?.trim();
  if (!expr || expr.length > 40) {
    return null;
  }
  return expr;
}

function isListRepeat(code: string): boolean {
  if (/\*\*/.test(code)) {
    return false;
  }
  const times = /\w+\s*\*\s*\d+|\[[^\]]+\]\s*\*\s*\d+/.test(code);
  const list = /=\s*\[/.test(code) || /\[[^\]]+\]\s*\*/.test(code);
  return times && list;
}

function looksLikeAttributeAssignment(line: string): boolean {
  return /^[A-Za-z_]\w*\.[A-Za-z_]\w*\s*=/.test(line.trim());
}

export function clipCaptionPageToSafeWindow({
  pageStartMs,
  pageEndMs,
  sceneStartFrame,
  fps,
  hookFrames,
  endCardFrom,
}: {
  pageStartMs: number;
  pageEndMs: number;
  sceneStartFrame: number;
  fps: number;
  hookFrames: number;
  endCardFrom: number;
}): { from: number; durationInFrames: number } | null {
  const rawFrom = Math.round((pageStartMs / 1000) * fps);
  const rawDuration = Math.max(
    1,
    Math.round(((pageEndMs - pageStartMs) / 1000) * fps),
  );
  const globalFrom = sceneStartFrame + rawFrom;
  const globalEnd = globalFrom + rawDuration;
  const safeFrom = Math.max(globalFrom, hookFrames);
  const safeEnd = Math.min(globalEnd, endCardFrom);
  if (safeEnd - safeFrom < 3) {
    return null;
  }
  return {
    from: safeFrom - sceneStartFrame,
    durationInFrames: safeEnd - safeFrom,
  };
}

export function calculateVolume(
  level: MusicVolumeEnum = MusicVolumeEnum.high,
): [number, boolean] {
  switch (level) {
    case "muted":
      return [0, true];
    case "low":
      return [0.2, false];
    case "medium":
      return [0.45, false];
    case "high":
      return [0.7, false];
    default:
      return [0.7, false];
  }
}

export function getDuckedMusicVolume({
  frame,
  baseVolume,
  muted,
  endCardFrom,
  duckRanges,
}: {
  frame: number;
  baseVolume: number;
  muted: boolean;
  endCardFrom: number;
  duckRanges?: { from: number; durationInFrames: number }[];
}): number {
  if (muted || baseVolume <= 0) {
    return 0;
  }
  const ducked = baseVolume * 0.38;
  let volume =
    frame >= endCardFrom
      ? lerp(frame, endCardFrom, endCardFrom + 10, ducked, baseVolume)
      : lerp(frame, 0, 8, 0, ducked);
  if (
    duckRanges?.some(
      (range) =>
        frame >= range.from && frame < range.from + range.durationInFrames,
    )
  ) {
    volume *= 0.18;
  }
  return volume;
}

function lerp(
  frame: number,
  from: number,
  to: number,
  startVal: number,
  endVal: number,
): number {
  if (to <= from) {
    return endVal;
  }
  if (frame <= from) {
    return startVal;
  }
  if (frame >= to) {
    return endVal;
  }
  const t = (frame - from) / (to - from);
  return startVal + (endVal - startVal) * t;
}
