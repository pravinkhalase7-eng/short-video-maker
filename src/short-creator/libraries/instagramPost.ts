import {
  parseQuizSheet,
  quizInstagramExplanation,
  quizSeriesBadge,
} from "../../components/utils";
import type { RenderConfig, SceneInput } from "../../types/shorts";

export type VideoPostMeta = {
  id: string;
  prompt: string;
  format?: string;
  createdAt: string;
  title: string;
  caption: string;
  explanation: string;
  hashtags: string[];
  instagramText: string;
  youtubeTitle: string;
  youtubeDescription: string;
};

export const YOUTUBE_TITLE_MAX = 100;
export const YOUTUBE_DESCRIPTION_MAX = 5000;

export function buildInstagramPost({
  id,
  prompt,
  scenes,
  config,
  explanation: providedExplanation,
}: {
  id: string;
  prompt?: string;
  scenes: SceneInput[];
  config?: RenderConfig;
  explanation?: string;
}): VideoPostMeta {
  const quizCard =
    scenes.find((scene) => scene.exampleCard?.kind === "quiz")?.exampleCard ||
    scenes[0]?.exampleCard;
  const sheet = quizCard
    ? parseQuizSheet({
        title: quizCard.title,
        body: quizCard.body,
      })
    : null;
  const isQuiz = config?.format === "quiz" || Boolean(sheet?.options.length);
  const promptText = (prompt || "").trim();
  const title = isQuiz
    ? quizTitle(sheet, quizCard?.title)
    : storyTitle(config?.hookText, promptText, scenes[0]?.text);
  const answerLetter = quizAnswerLetter(sheet, scenes);
  const generated = isQuiz && sheet
    ? quizInstagramExplanation({
        ...sheet,
        answer: answerLetter || sheet.answer,
      })
    : storyExplanation(scenes);
  const explanation = withAnswerLead(
    providedExplanation?.replace(/\s+/g, " ").trim() || generated,
    answerLetter,
  );
  const hideAnswerOnVideo = config?.quizEnding === "timeup";
  const caption = isQuiz
    ? hideAnswerOnVideo
      ? "Time's up. Comment A, B, C, or D. Follow for more."
      : "Comment A, B, C, or D before you scroll. Follow for more traps."
    : storyCaption(promptText, scenes[0]?.text, config?.endCardCta);
  const hashtags = fiveHashtags(promptText, sheet?.code || quizCard?.body || "", isQuiz);
  const instagramText = compactInstagramText([
    title,
    caption,
    ".\n.\n.",
    explanation,
    hashtags.join(" "),
  ]);
  const youtubeTitle = youtubeTitleWithHashtags(title, hashtags);
  const youtubeDescription = compactInstagramText([
    caption,
    explanation,
    hashtags.join(" "),
  ]).slice(0, YOUTUBE_DESCRIPTION_MAX);

  return {
    id,
    prompt: promptText,
    format: config?.format,
    createdAt: new Date().toISOString(),
    title,
    caption,
    explanation,
    hashtags,
    instagramText,
    youtubeTitle,
    youtubeDescription,
  };
}

function compactInstagramText(parts: string[]): string {
  return parts
    .map((part) => part.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean)
    .join("\n\n");
}

function quizAnswerLetter(
  sheet: ReturnType<typeof parseQuizSheet> | null,
  scenes: SceneInput[],
): string | null {
  const fromSheet = sheet?.answer && /^[A-D]$/i.test(sheet.answer) ? sheet.answer.toUpperCase() : "";
  const fromOverlay =
    scenes
      .map((scene) => scene.overlayText || scene.exampleCard?.title || "")
      .find((value) => /^[A-D]$/i.test(value))
      ?.toUpperCase() || "";
  return fromSheet || fromOverlay || null;
}

function withAnswerLead(explanation: string, letter: string | null): string {
  const text = explanation.replace(/\s+/g, " ").trim();
  if (!letter) {
    return text;
  }
  if (/answer is [A-D]\b/i.test(text)) {
    return text.replace(/the answer is [A-D]\b/i, `The answer is ${letter}`);
  }
  return `The answer is ${letter}. ${text}`.trim();
}

export function youtubeTitleWithHashtags(
  title: string,
  hashtags: string[],
): string {
  const tags = hashtags.filter(Boolean).slice(0, 3);
  const tagText = tags.join(" ");
  const maxHead = Math.max(
    32,
    YOUTUBE_TITLE_MAX - (tagText ? tagText.length + 1 : 0),
  );
  const head = title.replace(/\s+/g, " ").trim().slice(0, maxHead).trim();
  if (!tagText) {
    return head.slice(0, YOUTUBE_TITLE_MAX);
  }
  return `${head} ${tagText}`.slice(0, YOUTUBE_TITLE_MAX);
}

export function hydrateVideoPostMeta(meta: VideoPostMeta): VideoPostMeta {
  const hashtags = meta.hashtags || [];
  const explanation = (meta.explanation || "").trim();
  const instagramText = compactInstagramText([
    meta.title || "",
    meta.caption || "",
    ".\n.\n.",
    explanation,
    hashtags.join(" "),
  ]);
  return {
    ...meta,
    hashtags,
    explanation,
    instagramText: instagramText || meta.instagramText,
    youtubeTitle: youtubeTitleWithHashtags(meta.title || "", hashtags),
    youtubeDescription: compactInstagramText([
      meta.caption || "",
      explanation,
      hashtags.join(" "),
    ]).slice(0, YOUTUBE_DESCRIPTION_MAX),
  };
}

function quizTitle(
  sheet: ReturnType<typeof parseQuizSheet> | null,
  cardTitle?: string,
): string {
  const badge = quizSeriesBadge({
    title: cardTitle,
    body: sheet?.code || sheet?.question || "",
  });
  const question = (sheet?.question || "What is the output?")
    .replace(/\banswer\s*:.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const label = badge && badge !== "QUIZ" ? `${badge} Quiz` : cardTitle || "Coding Quiz";
  return `${label}: ${question}`.slice(0, 90);
}

function storyTitle(hook?: string, prompt?: string, firstLine?: string): string {
  const hookText = hook?.trim();
  if (hookText) {
    return hookText.slice(0, 90);
  }
  const fromPrompt = (prompt || firstLine || "New short")
    .replace(/\s+/g, " ")
    .trim();
  return fromPrompt.slice(0, 90);
}

function storyCaption(prompt: string, firstLine?: string, cta?: string): string {
  const body = (firstLine || prompt || "Watch till the end.").replace(/\s+/g, " ").trim();
  return `${body}\n\n${cta || "Follow for more."}`;
}

function storyExplanation(scenes: SceneInput[]): string {
  const last = [...scenes].reverse().find((scene) => scene.text.trim());
  return (last?.text || "Watch the full video for the takeaway.")
    .replace(/\s+/g, " ")
    .trim();
}

function fiveHashtags(prompt: string, code: string, isQuiz: boolean): string[] {
  const blob = `${prompt}\n${code}`.toLowerCase();
  const picked: string[] = [];
  const add = (tag: string) => {
    const clean = tag.startsWith("#") ? tag : `#${tag}`;
    if (!picked.includes(clean) && picked.length < 5) {
      picked.push(clean);
    }
  };
  if (/\bpython\b|def |print\(/.test(blob)) {
    add("#python");
    add("#learnpython");
  }
  if (/\bjava\b|system\.out/.test(blob)) {
    add("#java");
    add("#learnjava");
  }
  if (/\bjavascript\b|console\.log|const /.test(blob)) {
    add("#javascript");
    add("#webdev");
  }
  if (/\bsql\b|select /.test(blob)) {
    add("#sql");
    add("#data");
  }
  if (isQuiz) {
    add("#codingquiz");
    add("#programming");
    add("#techtok");
  } else {
    add("#shorts");
    add("#reels");
    add("#learnontiktok");
  }
  add("#100daysofcode");
  add("#coding");
  add("#developer");
  return picked.slice(0, 5);
}
