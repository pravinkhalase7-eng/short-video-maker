import { Config } from "../../config";
import { logger } from "../../logger";
import {
  parseQuizSheet,
  quizInstagramExplanation,
} from "../../components/utils";
import type { RenderConfig, SceneInput } from "../../types/shorts";

export function quizFactsFromScenes({
  prompt,
  scenes,
  config,
}: {
  prompt?: string;
  scenes: SceneInput[];
  config?: RenderConfig;
}): {
  question: string;
  code: string;
  options: string;
  answer: string;
  winning: string;
  heuristic: string;
} | null {
  const quizCard =
    scenes.find((scene) => scene.exampleCard?.kind === "quiz")?.exampleCard ||
    scenes[0]?.exampleCard;
  if (!quizCard?.body) {
    return null;
  }
  const answer =
    scenes
      .find((scene) => /^[A-D]$/i.test(scene.overlayText || ""))
      ?.overlayText?.toUpperCase() ||
    scenes
      .find((scene) => /^[A-D]$/i.test(scene.exampleCard?.title || ""))
      ?.exampleCard?.title?.toUpperCase() ||
    "";
  const sheet = parseQuizSheet({
    title: quizCard.title,
    body: quizCard.body,
    answer,
  });
  if (!sheet.options.length) {
    return null;
  }
  const letter = (sheet.answer || answer || "B").toUpperCase();
  const winning =
    sheet.options.find((option) => option.letter === letter)?.text || "";
  const heuristic = quizInstagramExplanation({
    ...sheet,
    answer: letter,
  });
  return {
    question: sheet.question || "What is the output?",
    code: sheet.code || "",
    options: sheet.options
      .map((option) => `${option.letter}) ${option.text}`)
      .join("\n"),
    answer: letter,
    winning,
    heuristic,
  };
}

export function quizExplanationPrompt(facts: {
  question: string;
  code: string;
  options: string;
  answer: string;
  winning: string;
  prompt?: string;
}): string {
  return `Explain this coding multiple-choice quiz for an Instagram caption.

Question: ${facts.question}
Code:
${facts.code || "(no snippet)"}
Options:
${facts.options}
Correct answer: ${facts.answer}
Correct output: ${facts.winning}
Original prompt:
${(facts.prompt || "").trim()}

Write 3 to 5 short sentences a beginner can understand.
Start with "The answer is ${facts.answer}."
Explain what the code actually does in plain English.
Name the most tempting wrong option and why that reading is wrong.
Do not use hashtags, markdown, a title, or the words "walk the snippet".
Do not change the correct letter.`;
}

export function sanitizeQuizExplanation(
  raw: string,
  answer: string,
): string | null {
  let text = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s+/gm, "")
    .replace(/#[A-Za-z0-9_]+/g, "")
    .replace(/\r/g, "")
    .replace(/^\s*(sure|okay|ok)[!.,]*\s+/i, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 40) {
    return null;
  }
  text = text.replace(/the answer is [a-d]\b/gi, `The answer is ${answer}`);
  if (!new RegExp(`^The answer is ${answer}\\b`, "i").test(text)) {
    text = `The answer is ${answer}. ${text}`;
  }
  if (text.length > 700) {
    text = `${text.slice(0, 697).replace(/\s+\S*$/, "")}.`;
  }
  return text;
}

export async function llmQuizExplanation(
  config: Config,
  facts: {
    question: string;
    code: string;
    options: string;
    answer: string;
    winning: string;
    prompt?: string;
  },
): Promise<string> {
  if (!config.geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY is required to generate the quiz explanation",
    );
  }
  const prompt = quizExplanationPrompt(facts);
  const text = await completeGemini(config, prompt);
  if (!text) {
    throw new Error("Gemini did not return a quiz explanation");
  }
  const clean = sanitizeQuizExplanation(text, facts.answer);
  if (!clean) {
    throw new Error("Gemini quiz explanation was empty after cleanup");
  }
  return clean;
}

async function completeGemini(config: Config, prompt: string): Promise<string | null> {
  const models = [
    config.geminiModel,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ].filter((model, index, all) => Boolean(model) && all.indexOf(model) === index);

  let lastError: unknown;
  for (const model of models) {
    try {
      logger.info({ model }, "Asking Gemini for the quiz explanation");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });
      if (!response.ok) {
        throw new Error(`Gemini ${model} HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("\n")
        .trim();
      if (text) {
        logger.info({ model }, "Wrote quiz explanation with Gemini");
        return text;
      }
      throw new Error(`Gemini ${model} returned empty content`);
    } catch (error: unknown) {
      lastError = error;
      logger.warn({ model, error }, "Gemini quiz explanation failed, trying next model");
    }
  }
  if (lastError) {
    logger.error(lastError, "All Gemini models failed for quiz explanation");
  }
  return null;
}
