import { Config } from "../../config";
import { logger } from "../../logger";
import { looksLikeCode } from "../../components/utils";
import {
  CaptionPositionEnum,
  MusicMoodEnum,
  MusicVolumeEnum,
  OrientationEnum,
  VoiceEnum,
  createShortInput,
  type CreateShortInput,
  type ExampleCard,
  type SceneInput,
  type TargetDurationSec,
  type VideoFormat,
} from "../../types/shorts";

export type GeneratedShort = CreateShortInput & {
  source: "llm" | "local";
};

export type ScriptGenerateOptions = {
  targetDurationSec?: TargetDurationSec;
  format?: VideoFormat;
};

export type NormalizedScriptOptions = {
  targetDurationSec: TargetDurationSec;
  format: VideoFormat;
};

const MUSIC_VALUES = new Set(Object.values(MusicMoodEnum));
const VOICE_VALUES = new Set(Object.values(VoiceEnum));
const CAPTION_POSITION_VALUES = new Set(Object.values(CaptionPositionEnum));
const ORIENTATION_VALUES = new Set(Object.values(OrientationEnum));
const MUSIC_VOLUME_VALUES = new Set(Object.values(MusicVolumeEnum));

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "about",
  "with",
  "from",
  "that",
  "this",
  "these",
  "those",
  "make",
  "create",
  "generate",
  "video",
  "videos",
  "short",
  "shorts",
  "reel",
  "reels",
  "tiktok",
  "youtube",
  "please",
  "want",
  "just",
  "like",
  "into",
  "your",
  "their",
  "them",
  "for",
  "you",
  "me",
  "my",
  "our",
  "using",
  "voice",
  "music",
  "caption",
  "portrait",
  "landscape",
]);

const MOOD_RULES: [RegExp, MusicMoodEnum][] = [
  [/\b(sad|grief|heartbreak|lonely|cry|loss)\b/i, MusicMoodEnum.sad],
  [
    /\b(melancholy|nostalgia|rainy|longing|alone)\b/i,
    MusicMoodEnum.melancholic,
  ],
  [/\b(happy|joy|smile|celebrate|fun|cheerful)\b/i, MusicMoodEnum.happy],
  [
    /\b(euphoric|party|club|hype|festival|high energy)\b/i,
    MusicMoodEnum.euphoric,
  ],
  [
    /\b(excited|energy|workout|motivat|hustle|pump)\b/i,
    MusicMoodEnum.excited,
  ],
  [/\b(uneasy|tension|suspense|thriller|anxious)\b/i, MusicMoodEnum.uneasy],
  [/\b(angry|rage|fight|intense|aggressive)\b/i, MusicMoodEnum.angry],
  [/\b(dark|horror|scary|sinister|night terror)\b/i, MusicMoodEnum.dark],
  [/\b(hope|dream|inspir|uplift|better days)\b/i, MusicMoodEnum.hopeful],
  [
    /\b(think|reflect|mindful|quiet thought|ponder)\b/i,
    MusicMoodEnum.contemplative,
  ],
  [/\b(funny|joke|quirky|comedy|lol|humor)\b/i, MusicMoodEnum.funny],
  [/\b(chill|relax|calm|coffee|lofi|peace|cozy)\b/i, MusicMoodEnum.chill],
];

const RELATED_VISUALS: Record<string, string[]> = {
  coffee: ["cafe", "cup"],
  morning: ["sunrise", "window"],
  cat: ["kitten", "home"],
  dog: ["puppy", "park"],
  ocean: ["waves", "beach"],
  city: ["skyline", "street"],
  workout: ["gym", "running"],
  food: ["kitchen", "cooking"],
  travel: ["airplane", "map"],
  space: ["galaxy", "stars"],
  nature: ["forest", "mountain"],
  rain: ["window", "umbrella"],
  honey: ["beehive", "jar"],
  kiwi: ["fruit", "slice"],
  banana: ["fruit", "peel"],
  bananas: ["fruit", "peel"],
};

export function normalizeScriptOptions(
  options?: ScriptGenerateOptions,
): NormalizedScriptOptions {
  const duration = options?.targetDurationSec;
  const targetDurationSec =
    duration === 60 || duration === 90 || duration === 120 ? duration : 30;
  const format = options?.format === "quiz" ? "quiz" : "story";
  return { targetDurationSec, format };
}

export function scriptLimits(options: NormalizedScriptOptions): {
  minScenes: number;
  maxScenes: number;
  questions: number;
  holdMs: number;
  wordTarget: number;
} {
  const { targetDurationSec, format } = options;
  if (format === "quiz") {
    const questions =
      targetDurationSec === 120
        ? 6
        : targetDurationSec === 90
          ? 4
          : targetDurationSec === 60
            ? 3
            : 2;
    return {
      questions,
      minScenes: questions * 2,
      maxScenes: questions * 2,
      holdMs: 3000,
      wordTarget: Math.max(
        40,
        Math.round((targetDurationSec - 4.7 - questions * 3) * 2.4),
      ),
    };
  }
  const table: Record<
    TargetDurationSec,
    { minScenes: number; maxScenes: number; wordTarget: number }
  > = {
    30: { minScenes: 4, maxScenes: 6, wordTarget: 65 },
    60: { minScenes: 6, maxScenes: 8, wordTarget: 140 },
    90: { minScenes: 8, maxScenes: 12, wordTarget: 215 },
    120: { minScenes: 10, maxScenes: 14, wordTarget: 290 },
  };
  return { questions: 0, holdMs: 0, ...table[targetDurationSec] };
}

const SYSTEM_PROMPT = `You create short-form video scripts for an automated video maker.
The tool converts each scene's "text" to English speech, burns captions, searches Pexels for background clips, slowly zooms the clip, ducks music under speech, holds hookText full-screen for 2 seconds with NO voice yet, then starts narration, shows an exampleCard as the hero visual, keeps captions small at the bottom, and shows an end card with endCardText, endCardBeats, and endCardCta after the last line.

Return JSON only, matching this shape:
{
  "scenes": [{
    "text": "spoken narration",
    "searchTerms": ["one-word", "terms"],
    "overlayText": "20%",
    "exampleCard": { "title": "AFTER", "body": "() -> doWork()", "kind": "code" }
  }],
  "config": {
    "paddingBack": 2500,
    "music": "chill",
    "captionPosition": "bottom",
    "captionBackgroundColor": "blue",
    "voice": "af_heart",
    "orientation": "portrait",
    "musicVolume": "low",
    "hookText": "SIX WORD HOOK",
    "hookDurationMs": 2200,
    "endCardText": "One takeaway line",
    "endCardCta": "Follow for more",
    "endCardBeats": ["forEach", "->", "streams"]
  }
}

Story structure (required):
1. hookText: 3-6 words. Must stop the scroll. Prefer a question or a specific claim ("map vs flatMap", "this Java trap"). Never "Master X in 30 seconds", "X explained simply", or "Let's learn X".
2. Follow the duration and format block at the top of this prompt for scene count, spoken length, quiz pairs, holdMs, and end card.
3. Stay on the user's topic in every spoken line.
4. endCardText: max 12 words.
5. endCardCta: short CTA such as "Follow for more" unless the user gives a handle.

Rules:
- English voiceover only. No hashtags, no stage directions.
- Never start with: "Let's talk about", "Here's what", "In this video", "Stay with me", "Today we", "Did you know" as filler. A real surprising fact is fine.
- overlayText: a number, 1-3 words, a quiz letter, or a tiny quote. Max 18 characters.
- exampleCard: required for programming/tech, numbered facts, and every quiz scene. Max 8 lines, 56 characters per line. kind "code" must be REAL short code. kind "fact" uses title as the number (230%) and body as 2-6 words. kind "quiz" is A/B/C options or an answer reveal. Include holdMs on quiz question scenes.
- endCardBeats: 2-3 short chips recapping the lesson or the quiz answers.
- searchTerms: 2-3 SINGLE visual words. Things Pexels can film. For a concrete topic use the object (banana, honey, jar, beehive). For food, search the food — never body, woman, man, skin, muscle, or gym unless the user asked for fitness. For an abstract topic like agentic AI, use filmable stand-ins (robot, laptop, code, typing) — never abstract words (agentic, autonomous, intelligence, workflow). Not negated words (do not search "water" for "no water"). Put the best filmable subject first in every scene.
- Stay on the user's topic. If they asked about bananas, every scene must say banana and search banana. Do not switch to a different subject.
- music must be one of: sad, melancholic, happy, euphoric/high, excited, chill, uneasy, angry, dark, hopeful, contemplative, funny/quirky
- captionPosition: bottom unless the user asks otherwise
- voice: Kokoro id. Prefix af=American female, am=American male, bf=British female, bm=British male. Default af_heart. Valid: af_heart, af_alloy, af_aoede, af_bella, af_jessica, af_kore, af_nicole, af_nova, af_river, af_sarah, af_sky, am_adam, am_echo, am_eric, am_fenrir, am_liam, am_michael, am_onyx, am_puck, am_santa, bf_emma, bf_isabella, bm_george, bm_lewis, bf_alice, bf_lily, bm_daniel, bm_fable
- orientation: portrait unless the user asks for landscape/widescreen
- musicVolume: low unless the user asks otherwise. muted if they want no music.
- paddingBack: 2500 so the end card has time to read
- hookDurationMs: 2200
- captionBackgroundColor: a CSS color. Default blue.`;

function buildSystemPrompt(options: NormalizedScriptOptions): string {
  const limits = scriptLimits(options);
  const durationRules =
    options.format === "quiz"
      ? `DURATION AND FORMAT:
- QUIZ MODE. Finished video length: ${options.targetDurationSec} seconds.
- Write exactly ${limits.questions} questions as ${limits.maxScenes} scenes.
- Each question is TWO scenes: (1) ask and read options A B C, (2) reveal the answer.
- Question scene: speak the question and the three options. exampleCard.kind is "quiz", title is "Q1"/"Q2"/..., body is three lines "A) ...\\nB) ...\\nC) ...". holdMs is ${limits.holdMs}. overlayText can be "Q1".
- Answer scene: "The answer is B." plus a concrete reason that names the topic. exampleCard.kind is "quiz", title is the letter, body is the winning option plus a short why. overlayText is the letter. holdMs is 0.
- hookText like "QUIZ: BANANAS" or "CAN YOU SCORE 3/3?".
- endCardText: "How many did you get right?"
- endCardBeats: the answer letters in order.
- About ${limits.wordTarget} spoken words total. Questions must be real facts about the user's topic.`
      : `DURATION AND FORMAT:
- STORY MODE. Finished video length: ${options.targetDurationSec} seconds.
- Write ${limits.minScenes} to ${limits.maxScenes} scenes.
- About ${limits.wordTarget} spoken words total. This is not three tiny sentences.
- Each scene: 1-3 spoken sentences, still easy to say, naming the subject.
- Last scene is the takeaway.`;

  return `${durationRules}\n\n${SYSTEM_PROMPT}`;
}

export function generateLocalScript(
  prompt: string,
  options?: ScriptGenerateOptions,
): CreateShortInput {
  const normalized = normalizeScriptOptions(options);
  const limits = scriptLimits(normalized);
  const topic = cleanTopic(prompt);
  const hookText =
    normalized.format === "quiz"
      ? makeQuizHookText(topic, limits.questions)
      : makeHookText(topic);
  const scenes: SceneInput[] =
    normalized.format === "quiz"
      ? pinTopicSearchTerms(
          buildLocalQuizScenes(prompt, topic, limits.questions, limits.holdMs),
          hookText,
          prompt,
        )
      : pinTopicSearchTerms(
          fillMissingExampleCards(
            splitIntoSceneTexts(prompt, limits.minScenes, limits.maxScenes)
              .map(stripFiller)
              .map((text, index) => ({
                text,
                searchTerms: searchTermsFor(text, prompt),
                overlayText: makeOverlayText(text, index),
              })),
            hookText,
          ),
          hookText,
          prompt,
        );

  return {
    scenes,
    config: {
      paddingBack: 2500,
      music: inferMood(prompt),
      captionPosition: CaptionPositionEnum.bottom,
      captionBackgroundColor: inferCaptionColor(prompt),
      voice: inferVoice(prompt),
      orientation: inferOrientation(prompt),
      musicVolume: inferMusicVolume(prompt),
      hookText,
      hookDurationMs: 2200,
      endCardText:
        normalized.format === "quiz"
          ? "How many did you get right?"
          : makeEndCardText(
              topic,
              scenes.map((scene) => scene.text),
            ),
      endCardCta: "Follow for more",
      endCardBeats:
        normalized.format === "quiz"
          ? quizAnswerBeats(scenes)
          : makeEndCardBeats(scenes),
      targetDurationSec: normalized.targetDurationSec,
      format: normalized.format,
    },
  };
}

export class PromptScriptGenerator {
  constructor(private config: Config) {}

  async generate(
    prompt: string,
    options?: ScriptGenerateOptions,
  ): Promise<GeneratedShort> {
    const trimmed = prompt.trim();
    const normalized = normalizeScriptOptions(options);
    if (this.config.geminiApiKey) {
      try {
        const generated = await this.generateWithGemini(trimmed, normalized);
        logger.info({ source: "gemini" }, "Generated short script with Gemini");
        return { ...generated, source: "llm" };
      } catch (error: unknown) {
        logger.warn(error, "Gemini script generation failed, trying fallbacks");
      }
    }

    if (this.config.openaiApiKey) {
      try {
        const generated = await this.generateWithOpenAI(trimmed, normalized);
        logger.info({ source: "openai" }, "Generated short script with OpenAI");
        return { ...generated, source: "llm" };
      } catch (error: unknown) {
        logger.warn(error, "OpenAI script generation failed, using local fallback");
      }
    }

    logger.info("Generating short script with local fallback");
    return { ...generateLocalScript(trimmed, normalized), source: "local" };
  }

  private async generateWithGemini(
    prompt: string,
    options: NormalizedScriptOptions,
  ): Promise<CreateShortInput> {
    const models = [
      this.config.geminiModel,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ].filter((model, index, all) => Boolean(model) && all.indexOf(model) === index);

    let lastError: unknown;
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.geminiApiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(options.targetDurationSec >= 90 ? 60000 : 45000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${buildSystemPrompt(options)}\n\nUser request:\n${prompt}\n\nFormat: ${options.format}. Target duration: ${options.targetDurationSec} seconds.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              responseMimeType: "application/json",
            },
          }),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Gemini ${model} HTTP ${response.status}: ${body}`);
        }

        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("\n");
        if (!text) {
          throw new Error(`Gemini ${model} returned empty content`);
        }
        return parseGeneratedShort(text, prompt, options);
      } catch (error: unknown) {
        lastError = error;
        logger.warn({ model, error }, "Gemini model failed");
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini generation failed");
  }

  private async generateWithOpenAI(
    prompt: string,
    options: NormalizedScriptOptions,
  ): Promise<CreateShortInput> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      signal: AbortSignal.timeout(options.targetDurationSec >= 90 ? 60000 : 45000),
      body: JSON.stringify({
        model: this.config.openaiModel,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(options) },
          {
            role: "user",
            content: `${prompt}\n\nFormat: ${options.format}. Target duration: ${options.targetDurationSec} seconds.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("OpenAI returned empty content");
    }
    return parseGeneratedShort(text, prompt, options);
  }
}

export function parseGeneratedShort(
  raw: string,
  userPrompt?: string,
  options?: ScriptGenerateOptions,
): CreateShortInput {
  const normalized = normalizeScriptOptions(options);
  const limits = scriptLimits(normalized);
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText) as {
    scenes?: {
      text?: unknown;
      searchTerms?: unknown;
      overlayText?: unknown;
      exampleCard?: unknown;
      holdMs?: unknown;
    }[];
    config?: Record<string, unknown>;
  };

  const scenes = (parsed.scenes || [])
    .map((scene, index) => {
      const text = stripFiller(String(scene.text || "").trim());
      return {
        text,
        searchTerms: normalizeSearchTerms(
          scene.searchTerms,
          String(scene.text || ""),
        ),
        overlayText:
          normalizeOverlayText(scene.overlayText) ||
          makeOverlayText(text, index),
        exampleCard: normalizeExampleCard(scene.exampleCard),
        holdMs: normalizeHoldMs(scene.holdMs),
      };
    })
    .filter((scene) => scene.text.length > 0)
    .slice(0, limits.maxScenes);

  if (scenes.length === 0) {
    throw new Error("Generated script had no scenes");
  }

  const config = parsed.config || {};
  const hookText =
    normalizeOptionalText(config.hookText, 60) ||
    (normalized.format === "quiz"
      ? makeQuizHookText(scenes[0].text, limits.questions)
      : makeHookText(scenes[0].text));
  const withCards =
    normalized.format === "quiz"
      ? applyQuizHolds(
          fillMissingQuizCards(scenes, hookText, userPrompt),
          limits.holdMs,
        )
      : fillMissingExampleCards(scenes, hookText);
  const result = {
    scenes: pinTopicSearchTerms(withCards, hookText, userPrompt),
    config: {
      paddingBack: normalizePadding(config.paddingBack),
      music: pickEnum(config.music, MUSIC_VALUES, MusicMoodEnum.chill),
      captionPosition: pickEnum(
        config.captionPosition,
        CAPTION_POSITION_VALUES,
        CaptionPositionEnum.bottom,
      ),
      captionBackgroundColor:
        typeof config.captionBackgroundColor === "string" &&
        config.captionBackgroundColor.trim()
          ? config.captionBackgroundColor.trim()
          : "blue",
      voice: pickEnum(config.voice, VOICE_VALUES, VoiceEnum.af_heart),
      orientation: pickEnum(
        config.orientation,
        ORIENTATION_VALUES,
        OrientationEnum.portrait,
      ),
      musicVolume: pickEnum(
        config.musicVolume,
        MUSIC_VOLUME_VALUES,
        MusicVolumeEnum.low,
      ),
      hookText,
      hookDurationMs: normalizeHookDuration(config.hookDurationMs),
      endCardText:
        normalizeOptionalText(config.endCardText, 90) ||
        (normalized.format === "quiz"
          ? "How many did you get right?"
          : makeEndCardText(
              "",
              scenes.map((scene) => scene.text),
            )),
      endCardCta:
        normalizeOptionalText(config.endCardCta, 40) || "Follow for more",
      endCardBeats:
        normalizeEndCardBeats(config.endCardBeats) ||
        (normalized.format === "quiz"
          ? quizAnswerBeats(withCards)
          : makeEndCardBeats(withCards)),
      targetDurationSec: normalized.targetDurationSec,
      format: normalized.format,
    },
  };

  return createShortInput.parse(result);
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw.trim();
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  fallback: T,
): T {
  if (typeof value === "string" && allowed.has(value as T)) {
    return value as T;
  }
  return fallback;
}

function normalizePadding(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 2500;
  }
  return Math.min(Math.round(parsed), 10000);
}

function normalizeHoldMs(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.min(Math.max(Math.round(parsed), 0), 8000);
}

function normalizeHookDuration(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 2200;
  }
  return Math.min(Math.max(Math.round(parsed), 800), 4000);
}

function normalizeOptionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function stripFiller(text: string): string {
  const stripped = text
    .replace(
      /^(let'?s talk about|here'?s what|in this video|stay with me|today we(?:'re| are) going to|so basically)\s+/i,
      "",
    )
    .trim();
  return ensureSpokenSentence(stripped || text);
}

function normalizeSearchTerms(value: unknown, fallbackText: string): string[] {
  const avoided = negatedWords(fallbackText);
  const rawTerms = Array.isArray(value)
    ? value.map((term) => String(term))
    : typeof value === "string"
      ? value.split(",")
      : [];
  const terms = uniqueTerms(
    rawTerms
      .map(toSingleVisualWord)
      .filter((term) => Boolean(term) && !avoided.has(term) && !ABSTRACT_SEARCH_WORDS.has(term)),
  );
  if (terms.length >= 2) {
    return terms.slice(0, 3);
  }
  return searchTermsFor(fallbackText, fallbackText);
}

function toSingleVisualWord(term: string): string {
  const words = term
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  if (words.length === 0) {
    return "";
  }
  return [...words].sort((a, b) => b.length - a.length)[0];
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms) {
    if (!seen.has(term)) {
      seen.add(term);
      result.push(term);
    }
  }
  return result;
}

const HOOK_SKIP_WORDS = new Set([
  ...STOP_WORDS,
  "why",
  "does",
  "never",
  "actually",
  "what",
  "how",
  "when",
  "will",
  "really",
  "always",
  "still",
  "true",
  "truth",
  "expire",
  "expires",
  "should",
  "would",
  "could",
  "might",
  "must",
  "daily",
  "every",
  "eating",
  "eaten",
  "helps",
  "help",
  "benefit",
  "benefits",
  "body",
  "bodies",
  "woman",
  "women",
  "man",
  "men",
  "person",
  "people",
  "girl",
  "girls",
  "guy",
  "guys",
  "skin",
  "muscle",
  "muscles",
  "torso",
  "chest",
  "fitness",
  "portrait",
  "model",
]);

const ABSTRACT_SEARCH_WORDS = new Set([
  "environment",
  "enzyme",
  "acidity",
  "hydrogen",
  "peroxide",
  "moisture",
  "chemistry",
  "unique",
  "thanks",
  "forever",
  "truly",
  "special",
  "breaks",
  "zero",
  "pure",
  "lasts",
  "found",
  "bacteria",
  "minutes",
  "because",
  "without",
  "agentic",
  "autonomous",
  "digital",
  "software",
  "workflow",
  "workflows",
  "assistant",
  "independent",
  "complex",
  "modern",
  "passive",
  "active",
  "beyond",
  "intelligence",
  "artificial",
]);

const CONCEPT_VISUALS: Record<string, string[]> = {
  agentic: ["robot", "laptop", "coding"],
  ai: ["robot", "laptop", "code"],
  artificial: ["robot", "circuit"],
  intelligence: ["robot", "laptop"],
  autonomous: ["robot", "laptop"],
  chatbot: ["laptop", "phone"],
  software: ["laptop", "code"],
  computer: ["laptop", "keyboard"],
  java: ["code", "laptop", "keyboard"],
  lambda: ["code", "laptop", "keyboard"],
  lambdas: ["code", "laptop", "keyboard"],
  python: ["code", "laptop", "keyboard"],
  javascript: ["code", "laptop", "keyboard"],
};

function negatedWords(text: string): Set<string> {
  const avoided = new Set<string>();
  for (const match of text.matchAll(/\b(?:no|not|without|zero)\s+([a-z]+)/gi)) {
    avoided.add(match[1].toLowerCase());
  }
  return avoided;
}

function topicVisualWord(...texts: string[]): string | undefined {
  const words = texts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        (word.length >= 4 || word === "ai") && !HOOK_SKIP_WORDS.has(word),
    );
  const known = words.find(
    (word) => RELATED_VISUALS[word] || CONCEPT_VISUALS[word],
  );
  return known || words.find((word) => !ABSTRACT_SEARCH_WORDS.has(word)) || words[0];
}

function filmableTermsFor(topic?: string): string[] {
  if (!topic) {
    return [];
  }
  if (CONCEPT_VISUALS[topic]) {
    return CONCEPT_VISUALS[topic];
  }
  if (RELATED_VISUALS[topic]) {
    return [topic, ...RELATED_VISUALS[topic]];
  }
  if (ABSTRACT_SEARCH_WORDS.has(topic) || HOOK_SKIP_WORDS.has(topic)) {
    return [];
  }
  return [topic];
}

export function pinTopicSearchTerms(
  scenes: SceneInput[],
  hookText?: string,
  userPrompt?: string,
): SceneInput[] {
  const topic = topicVisualWord(
    userPrompt || "",
    hookText || "",
    ...scenes.map((scene) => scene.text),
  );
  const topicVisuals = filmableTermsFor(topic);
  return scenes.map((scene) => {
    const avoided = negatedWords(scene.text);
    const cleaned = scene.searchTerms.filter(
      (term) =>
        !avoided.has(term) &&
        !ABSTRACT_SEARCH_WORDS.has(term) &&
        !HOOK_SKIP_WORDS.has(term),
    );
    const ordered = uniqueTerms([...topicVisuals, ...cleaned]);
    while (ordered.length < 2) {
      const pad = topicVisuals[ordered.length] || "nature";
      if (!ordered.includes(pad)) {
        ordered.push(pad);
      } else {
        ordered.push("nature");
      }
    }
    return { ...scene, searchTerms: ordered.slice(0, 3) };
  });
}

function splitIntoSceneTexts(
  prompt: string,
  minScenes = 3,
  maxScenes = 5,
): string[] {
  const lines = prompt
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]\s+|[-*]\s+)/, "").trim())
    .filter(Boolean);
  if (lines.length >= 2 && /^\s*(?:\d+[.)]|[-*])/m.test(prompt)) {
    return lines.slice(0, maxScenes).map(ensureSpokenSentence);
  }

  const sentences = prompt
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8);

  if (sentences.length >= 2) {
    return groupSentences(sentences, minScenes, maxScenes).map(
      ensureSpokenSentence,
    );
  }

  return expandTopic(cleanTopic(prompt), minScenes);
}

function groupSentences(
  sentences: string[],
  minScenes: number,
  maxScenes: number,
): string[] {
  const sceneCount = Math.min(maxScenes, Math.max(minScenes, sentences.length));
  const scenes: string[] = [];
  const perScene = Math.ceil(sentences.length / sceneCount);
  for (let i = 0; i < sentences.length; i += perScene) {
    scenes.push(sentences.slice(i, i + perScene).join(" "));
  }
  return scenes.slice(0, maxScenes);
}

function expandTopic(topic: string, sceneCount = 3): string[] {
  const subject = topic || "this idea";
  const beats = [
    `${capitalizePhrase(subject)} is simpler than it looks.`,
    `It shows up in ordinary moments if you watch for it.`,
    `Notice it once, and you will see it everywhere.`,
    `Small details around ${subject} add up faster than people expect.`,
    `Use ${subject} once on purpose, then it starts to stick.`,
    `Most people skip the basics of ${subject} and then get stuck.`,
    `A concrete example of ${subject} beats a vague rule every time.`,
    `Keep ${subject} in the next thing you actually do.`,
    `The mistake is treating ${subject} as optional.`,
    `Practice ${subject} in tiny repeats, not one long grind.`,
    `When ${subject} clicks, the rest of the work gets lighter.`,
    `The takeaway: keep ${subject} visible in your next move.`,
    `If you only remember one thing about ${subject}, remember this.`,
    `That is why ${subject} is worth doing today, not later.`,
  ];
  return beats.slice(0, Math.max(3, sceneCount));
}

function makeHookText(topic: string): string {
  const words = (topic || "watch this")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const label = words.map(capitalizeWord).join(" ");
  if (/\?$/.test(topic)) {
    return label.slice(0, 48);
  }
  return `Why ${label}?`.slice(0, 48);
}

function makeQuizHookText(topic: string, questions: number): string {
  const words = (topic || "this")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map(capitalizeWord)
    .join(" ");
  return `Quiz: ${words}`.slice(0, 48) || `Can you score ${questions}/${questions}?`;
}

function quizAnswerBeats(scenes: SceneInput[]): string[] | undefined {
  const letters = scenes
    .map((scene) => (scene.exampleCard?.title || scene.overlayText || "").trim())
    .filter((title) => /^[A-D]$/i.test(title))
    .map((title) => title.toUpperCase());
  const unique = [...new Set(letters)];
  return unique.length >= 2 ? unique.slice(0, 3) : ["A", "B", "C"];
}

function applyQuizHolds(scenes: SceneInput[], holdMs: number): SceneInput[] {
  return scenes.map((scene, index) => {
    if (scene.holdMs && scene.holdMs > 0) {
      return scene;
    }
    const title = scene.exampleCard?.title || "";
    const isQuestion =
      scene.exampleCard?.kind === "quiz" && /^Q\d+/i.test(title);
    const isQuestionPair = index % 2 === 0 && Boolean(scenes[index + 1]);
    if (isQuestion || isQuestionPair) {
      return { ...scene, holdMs };
    }
    return scene;
  });
}

function fillMissingQuizCards(
  scenes: SceneInput[],
  hookText?: string,
  userPrompt?: string,
): SceneInput[] {
  const topic = cleanTopic(userPrompt || hookText || scenes[0]?.text || "this");
  return scenes.map((scene, index) => {
    if (scene.exampleCard?.kind === "quiz" && scene.exampleCard.body) {
      return scene;
    }
    const n = Math.floor(index / 2) + 1;
    if (index % 2 === 0) {
      return {
        ...scene,
        overlayText: scene.overlayText || `Q${n}`,
        exampleCard: {
          kind: "quiz",
          title: `Q${n}`,
          body: `A) A common myth about ${topic}\nB) The useful truth about ${topic}\nC) It only works for experts`,
        },
      };
    }
    return {
      ...scene,
      overlayText: scene.overlayText || "B",
      exampleCard: {
        kind: "quiz",
        title: "B",
        body: `The useful truth about ${topic}`,
      },
    };
  });
}

type QuizItem = {
  question: string;
  options: [string, string, string];
  answer: "A" | "B" | "C";
  explain: string;
};

function buildLocalQuizScenes(
  prompt: string,
  topic: string,
  questionCount: number,
  holdMs: number,
): SceneInput[] {
  const bank = localQuizBank(topic, prompt);
  const scenes: SceneInput[] = [];
  for (let i = 0; i < questionCount; i += 1) {
    const item = bank[i % bank.length];
    const n = i + 1;
    const letters = ["A", "B", "C"] as const;
    const spokenOptions = item.options
      .map((option, index) => `${letters[index]}, ${option}`)
      .join(". ");
    scenes.push({
      text: `Question ${n}. ${item.question} ${spokenOptions}. Pause and pick one.`,
      searchTerms: searchTermsFor(item.question, prompt),
      overlayText: `Q${n}`,
      holdMs,
      exampleCard: {
        kind: "quiz",
        title: `Q${n}`,
        body: item.options
          .map((option, index) => `${letters[index]}) ${option}`)
          .join("\n"),
      },
    });
    const answerText =
      item.options[{"A": 0, "B": 1, "C": 2}[item.answer]];
    scenes.push({
      text: `The answer is ${item.answer}. ${item.explain}`,
      searchTerms: searchTermsFor(item.explain, prompt),
      overlayText: item.answer,
      exampleCard: {
        kind: "quiz",
        title: item.answer,
        body: answerText,
      },
    });
  }
  return scenes;
}

function localQuizBank(topic: string, prompt: string): QuizItem[] {
  const subject = topic || "this topic";
  if (isCodeTopic(prompt, topic)) {
    return [
      {
        question: `What did ${subject} mainly replace in everyday code?`,
        options: [
          "Hash maps",
          "Verbose anonymous classes",
          "Database tables",
        ],
        answer: "B",
        explain: `${subject} replaced bulky anonymous classes with a short function.`,
      },
      {
        question: `Where does ${subject} show up most clearly?`,
        options: [
          "One tiny callback",
          "A giant config file",
          "CSS only",
        ],
        answer: "A",
        explain: `You see ${subject} first in a tiny callback, not a huge rewrite.`,
      },
      {
        question: `What is the fastest way to learn ${subject}?`,
        options: [
          "Memorize every rule",
          "Skip the types",
          "Rewrite one real example",
        ],
        answer: "C",
        explain: `Rewrite one real example of ${subject} and the pattern sticks.`,
      },
      {
        question: `Which statement about ${subject} is true?`,
        options: [
          "It is only for experts",
          "It is a shorter way to pass behavior",
          "It deletes loops forever",
        ],
        answer: "B",
        explain: `${subject} is just a shorter way to pass behavior into a method.`,
      },
      {
        question: `What should you avoid with ${subject}?`,
        options: [
          "Naming the action",
          "Keeping it on one line",
          "Hiding ten steps inside it",
        ],
        answer: "C",
        explain: `Do not hide ten steps inside ${subject}. Keep the action obvious.`,
      },
      {
        question: `When is ${subject} the wrong tool?`,
        options: [
          "A one-line transform",
          "A long business workflow",
          "A simple filter",
        ],
        answer: "B",
        explain: `A long business workflow is clearer as named methods, not ${subject}.`,
      },
    ];
  }
  return [
    {
      question: `Which fact about ${subject} is actually useful?`,
      options: [
        "It only works once",
        "Small daily use compounds",
        "Experts must supervise it",
      ],
      answer: "B",
      explain: `Small daily use of ${subject} compounds faster than one perfect try.`,
    },
    {
      question: `What should you do first with ${subject}?`,
      options: [
        "Memorize every rule",
        "Skip the basics",
        "Try one concrete example",
      ],
      answer: "C",
      explain: `Try one concrete example of ${subject} before collecting more facts.`,
    },
    {
      question: `What do people get wrong about ${subject}?`,
      options: [
        "They treat it as optional",
        "They use it every day",
        "They keep examples tiny",
      ],
      answer: "A",
      explain: `People treat ${subject} as optional, then wonder why nothing changes.`,
    },
    {
      question: `How do you remember ${subject}?`,
      options: [
        "A vague slogan",
        "One picture and one number",
        "A long lecture",
      ],
      answer: "B",
      explain: `One picture and one number about ${subject} beats a long lecture.`,
    },
    {
      question: `When does ${subject} matter most?`,
      options: [
        "In ordinary daily moments",
        "Only on special occasions",
        "Only in a lab",
      ],
      answer: "A",
      explain: `${subject} matters in ordinary daily moments, not only special ones.`,
    },
    {
      question: `What is the takeaway on ${subject}?`,
      options: [
        "Wait until you are ready",
        "Use it in the next thing you do",
        "Collect more tips first",
      ],
      answer: "B",
      explain: `Use ${subject} in the next thing you do, not after more tips.`,
    },
  ];
}

function normalizeOverlayText(value: unknown): string | undefined {
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number"
        ? String(value)
        : "";
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 18);
}

function makeOverlayText(text: string, _index: number): string | undefined {
  const numberMatch = text.match(/\b(\d[\d,]*(?:\.\d+)?%?)/);
  if (numberMatch) {
    return numberMatch[1];
  }
  const quoted = text.match(/["“]([^"”]{2,16})["”]/);
  if (quoted) {
    return quoted[1].trim();
  }
  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) {
    return undefined;
  }
  const punch = [...words].sort((a, b) => b.length - a.length)[0];
  return punch.slice(0, 14).toUpperCase();
}

const CODE_TOPIC_PATTERN =
  /\b(java|lambda|lambdas|python|javascript|typescript|react|kotlin|golang|rust|sql|docker|kubernetes|api|function|functions|class|coding|code|programmer|programming|streams)\b/i;

function isCodeTopic(...texts: string[]): boolean {
  return texts.some((text) => CODE_TOPIC_PATTERN.test(text));
}

function clampCardBody(body: string, kind?: string): string {
  const maxLines = kind === "quiz" ? 8 : 6;
  const maxChars = kind === "quiz" ? 56 : 42;
  const maxTotal = kind === "quiz" ? 400 : 280;
  return body
    .replace(/\t/g, "  ")
    .split(/\r?\n/)
    .slice(0, maxLines)
    .map((line) => line.slice(0, maxChars))
    .join("\n")
    .slice(0, maxTotal)
    .trim();
}

function looksLikeQuizCard(title: string | undefined, body: string): boolean {
  if (/^Q\d+$/i.test(title || "") || /^[A-D]$/i.test(title || "")) {
    return true;
  }
  return /(?:^|\n)\s*[A-D][).:\-]\s+\S+/i.test(body);
}

export function normalizeExampleCard(value: unknown): ExampleCard | undefined {
  if (typeof value === "string" && value.trim()) {
    const body = clampCardBody(value);
    return {
      body,
      kind: looksLikeCode(body) ? "code" : "fact",
    };
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const obj = value as {
    title?: unknown;
    body?: unknown;
    kind?: unknown;
    lines?: unknown;
  };
  const body =
    typeof obj.body === "string"
      ? obj.body
      : Array.isArray(obj.lines)
        ? obj.lines.map((line) => String(line)).join("\n")
        : "";
  if (!body.trim()) {
    return undefined;
  }
  const title = normalizeOptionalText(obj.title, 24);
  const quiz = obj.kind === "quiz" || looksLikeQuizCard(title, body);
  const clamped = clampCardBody(body, quiz ? "quiz" : undefined);
  const kind = quiz
    ? "quiz"
    : looksLikeCode(clamped)
      ? "code"
      : obj.kind === "code"
        ? "code"
        : "fact";
  return {
    title,
    body: clamped,
    kind,
  };
}

function codePresetFor(corpus: string): ExampleCard[] {
  if (/\b(lambda|lambdas|java\s*8|java8)\b/i.test(corpus)) {
    return [
      {
        kind: "code",
        title: "BEFORE",
        body: "new Action() {\n  public void run() {\n    doWork();\n  }\n}",
      },
      {
        kind: "code",
        title: "AFTER",
        body: "() -> doWork()",
      },
      {
        kind: "code",
        title: "FOREACH",
        body: "list.forEach(x ->\n  process(x));",
      },
      {
        kind: "code",
        title: "STREAMS",
        body: "list.stream()\n  .filter(x -> x.ok)\n  .toList();",
      },
    ];
  }
  if (/\bpython\b/i.test(corpus)) {
    return [
      {
        kind: "code",
        title: "BEFORE",
        body: "def add(a, b):\n  return a + b",
      },
      {
        kind: "code",
        title: "AFTER",
        body: "add = lambda a, b: a + b",
      },
      {
        kind: "code",
        title: "MAP",
        body: "[x * 2 for x in items]",
      },
    ];
  }
  return [
    {
      kind: "code",
      title: "BEFORE",
      body: "function add(a, b) {\n  return a + b;\n}",
    },
    {
      kind: "code",
      title: "AFTER",
      body: "(a, b) => a + b",
    },
    {
      kind: "code",
      title: "MAP",
      body: "items.map(x => x.id)",
    },
    {
      kind: "code",
      title: "FILTER",
      body: "data.filter(x => x.ok)",
    },
  ];
}

function makeFactCard(
  text: string,
  overlay?: string,
): ExampleCard | undefined {
  const title = overlay || makeOverlayText(text, 0);
  if (!title || !/\d/.test(title)) {
    return undefined;
  }
  const body = text
    .replace(/\b(\d[\d,]*(?:\.\d+)?%?)/, "")
    .replace(/[.,!?]+$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
  if (!body) {
    return undefined;
  }
  return {
    kind: "fact",
    title,
    body: body.slice(0, 48),
  };
}

export function fillMissingExampleCards(
  scenes: SceneInput[],
  hookText?: string,
): SceneInput[] {
  const corpus = `${hookText || ""} ${scenes.map((scene) => scene.text).join(" ")}`;
  const preset = isCodeTopic(corpus) ? codePresetFor(corpus) : [];
  return scenes.map((scene, index) => {
    const exampleCard =
      scene.exampleCard ||
      preset[index] ||
      makeFactCard(scene.text, scene.overlayText);
    return {
      ...scene,
      exampleCard,
    };
  });
}

function normalizeEndCardBeats(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const beats = value
    .map((beat) => String(beat).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((beat) => beat.slice(0, 16))
    .slice(0, 3);
  return beats.length >= 2 ? beats : undefined;
}

function makeEndCardBeats(scenes: SceneInput[]): string[] | undefined {
  const beats: string[] = [];
  const seen = new Set<string>();
  for (const scene of scenes) {
    const beat = (scene.exampleCard?.title || scene.overlayText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 16);
    const key = beat.toLowerCase();
    if (!beat || seen.has(key)) {
      continue;
    }
    seen.add(key);
    beats.push(beat);
  }
  return beats.length >= 2 ? beats.slice(0, 3) : undefined;
}

function makeEndCardText(topic: string, sceneTexts: string[]): string {
  const last = sceneTexts[sceneTexts.length - 1] || topic;
  const withoutPeriod = last.replace(/[.,!?]+$/, "");
  if (withoutPeriod.split(/\s+/).length <= 12) {
    return withoutPeriod;
  }
  return `Remember this about ${topic}`.slice(0, 90);
}

function capitalizePhrase(text: string): string {
  if (!text) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function capitalizeWord(word: string): string {
  if (!word) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function cleanTopic(prompt: string): string {
  const cleaned = prompt
    .replace(
      /^(please\s+)?(make|create|generate|i want)(\s+me)?\s+(a|an)\s*/i,
      "",
    )
    .replace(
      /\b(tiktok|instagram|reels?|youtube shorts?|short[- ]form|portrait|landscape|widescreen)\b/gi,
      "",
    )
    .replace(/\b(with a )?(british )?(male|female) voice\b/gi, "")
    .replace(
      /\b(chill|sad|happy|dark|excited|funny|hopeful) music\b/gi,
      "",
    )
    .replace(/\b(video|reel|short|about)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,!?]+$/, "");
  return cleaned || prompt.trim();
}

function searchTermsFor(text: string, prompt: string): string[] {
  const avoided = negatedWords(`${prompt} ${text}`);
  const terms = uniqueTerms(
    `${prompt} ${text}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 2 &&
          !STOP_WORDS.has(word) &&
          !HOOK_SKIP_WORDS.has(word) &&
          !avoided.has(word) &&
          !ABSTRACT_SEARCH_WORDS.has(word),
      ),
  );

  const extras = terms.flatMap((term) => RELATED_VISUALS[term] || []);
  const combined = uniqueTerms([...terms, ...extras]);
  const picked = combined.slice(0, 3);
  while (picked.length < 2) {
    picked.push(["nature", "city", "ocean"][picked.length]);
  }
  return picked.slice(0, 3);
}

function inferMood(prompt: string): MusicMoodEnum {
  for (const [pattern, mood] of MOOD_RULES) {
    if (pattern.test(prompt)) {
      return mood;
    }
  }
  return MusicMoodEnum.chill;
}

function inferVoice(prompt: string): VoiceEnum {
  const british = /\b(british|uk accent|english accent)\b/i.test(prompt);
  const male = /\b(male|man|guy|deep voice)\b/i.test(prompt);
  const female = /\b(female|woman|girl)\b/i.test(prompt);
  if (british && male) {
    return VoiceEnum.bm_george;
  }
  if (british && female) {
    return VoiceEnum.bf_emma;
  }
  if (male) {
    return VoiceEnum.am_michael;
  }
  if (female) {
    return VoiceEnum.af_heart;
  }
  return VoiceEnum.af_heart;
}

function inferOrientation(prompt: string): OrientationEnum {
  if (/\b(landscape|widescreen|horizontal)\b/i.test(prompt)) {
    return OrientationEnum.landscape;
  }
  return OrientationEnum.portrait;
}

function inferMusicVolume(prompt: string): MusicVolumeEnum {
  if (/\b(no music|without music|muted|silent background)\b/i.test(prompt)) {
    return MusicVolumeEnum.muted;
  }
  if (/\b(loud music|music loud|turn up the music)\b/i.test(prompt)) {
    return MusicVolumeEnum.high;
  }
  return MusicVolumeEnum.low;
}

function inferCaptionColor(prompt: string): string {
  const match = prompt.match(
    /\b(red|blue|green|black|white|orange|purple|pink|gold|yellow)\b/i,
  );
  return match?.[1]?.toLowerCase() || "blue";
}

function ensureSpokenSentence(text: string): string {
  const trimmed = text.trim();
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}
