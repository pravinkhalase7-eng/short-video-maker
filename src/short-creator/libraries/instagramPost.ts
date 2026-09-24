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
};

export function buildInstagramPost({
  id,
  prompt,
  scenes,
  config,
}: {
  id: string;
  prompt?: string;
  scenes: SceneInput[];
  config?: RenderConfig;
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
  const explanation = isQuiz && sheet
    ? quizInstagramExplanation({
        ...sheet,
        answer:
          sheet.answer ||
          scenes.find((scene) => /^[A-D]$/i.test(scene.overlayText || ""))
            ?.overlayText?.toUpperCase() ||
          scenes.find((scene) => /^[A-D]$/i.test(scene.exampleCard?.title || ""))
            ?.exampleCard?.title?.toUpperCase() ||
          null,
      })
    : storyExplanation(scenes);
  const caption = isQuiz
    ? "Comment A, B, C, or D before you scroll. Follow for more traps."
    : storyCaption(promptText, scenes[0]?.text, config?.endCardCta);
  const hashtags = fiveHashtags(promptText, sheet?.code || quizCard?.body || "", isQuiz);
  const instagramText = compactInstagramText([
    title,
    caption,
    ".\n.\n.",
    explanation,
    hashtags.join(" "),
  ]);

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
  };
}

function compactInstagramText(parts: string[]): string {
  return parts
    .map((part) => part.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean)
    .join("\n\n");
}

function quizTitle(
  sheet: ReturnType<typeof parseQuizSheet> | null,
  cardTitle?: string,
): string {
  const badge = quizSeriesBadge({
    title: cardTitle,
    body: sheet?.code || sheet?.question || "",
  });
  const question = (sheet?.question || "What is the output?").replace(/\s+/g, " ").trim();
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
