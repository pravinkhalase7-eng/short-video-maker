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
} from "../../types/shorts";

export type GeneratedShort = CreateShortInput & {
  source: "llm" | "local";
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
};

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
2. Scene 1 spoken text: name the subject in the sentence (say "honey", not "it"). Land the hook. Do not introduce the video.
3. Scenes 2-3: concrete beats people can picture. Prefer facts, steps, or vivid details.
4. Last scene: the takeaway, spoken in one short line, still naming the subject.
5. endCardText: max 12 words, the same idea as the takeaway, written for the screen.
6. endCardCta: short CTA such as "Follow for more" unless the user gives a handle.

Rules:
- English voiceover only. 3 to 4 scenes.
- Each scene: one short spoken sentence, ideally under 16 words. No hashtags, no stage directions.
- Never start with: "Let's talk about", "Here's what", "In this video", "Stay with me", "Today we", "Did you know" as filler. A real surprising fact is fine.
- overlayText: a number, 1-3 words, or a tiny quote. Max 18 characters. Skip it when exampleCard is present.
- exampleCard: required for programming/tech and for numbered facts. Max 6 lines, 40 characters per line. kind "code" must be REAL short code that matches the spoken beat. For a before/after lesson, scene 1 is the verbose version (title BEFORE) and scene 2 is the one-liner (title AFTER). kind "fact" uses title as the number (230%) and body as 2-6 words ("more than an orange").
- endCardBeats: 2-3 short chips recapping the lesson, e.g. ["BEFORE", "AFTER", "STREAMS"] or ["forEach", "->", "streams"].
- searchTerms: 2-3 SINGLE visual words. Things Pexels can film. For a concrete topic use the object (honey, jar, beehive). For an abstract topic like agentic AI, use filmable stand-ins (robot, laptop, code, typing) — never abstract words (agentic, autonomous, intelligence, workflow). Not negated words (do not search "water" for "no water"). Put the best filmable subject first in every scene.
- music must be one of: sad, melancholic, happy, euphoric/high, excited, chill, uneasy, angry, dark, hopeful, contemplative, funny/quirky
- captionPosition: bottom unless the user asks otherwise
- voice: Kokoro id. Prefix af=American female, am=American male, bf=British female, bm=British male. Default af_heart. Valid: af_heart, af_alloy, af_aoede, af_bella, af_jessica, af_kore, af_nicole, af_nova, af_river, af_sarah, af_sky, am_adam, am_echo, am_eric, am_fenrir, am_liam, am_michael, am_onyx, am_puck, am_santa, bf_emma, bf_isabella, bm_george, bm_lewis, bf_alice, bf_lily, bm_daniel, bm_fable
- orientation: portrait unless the user asks for landscape/widescreen
- musicVolume: low unless the user asks otherwise. muted if they want no music.
- paddingBack: 2500 so the end card has time to read
- hookDurationMs: 2200
- captionBackgroundColor: a CSS color. Default blue.`;

export function generateLocalScript(prompt: string): CreateShortInput {
  const topic = cleanTopic(prompt);
  const sceneTexts = splitIntoSceneTexts(prompt).map(stripFiller);
  const hookText = makeHookText(topic);
  const scenes: SceneInput[] = pinTopicSearchTerms(
    fillMissingExampleCards(
      sceneTexts.map((text, index) => ({
        text,
        searchTerms: searchTermsFor(text, prompt),
        overlayText: makeOverlayText(text, index),
      })),
      hookText,
    ),
    hookText,
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
      endCardText: makeEndCardText(topic, sceneTexts),
      endCardCta: "Follow for more",
      endCardBeats: makeEndCardBeats(scenes),
    },
  };
}

export class PromptScriptGenerator {
  constructor(private config: Config) {}

  async generate(prompt: string): Promise<GeneratedShort> {
    const trimmed = prompt.trim();
    if (this.config.geminiApiKey) {
      try {
        const generated = await this.generateWithGemini(trimmed);
        logger.info({ source: "gemini" }, "Generated short script with Gemini");
        return { ...generated, source: "llm" };
      } catch (error: unknown) {
        logger.warn(error, "Gemini script generation failed, trying fallbacks");
      }
    }

    if (this.config.openaiApiKey) {
      try {
        const generated = await this.generateWithOpenAI(trimmed);
        logger.info({ source: "openai" }, "Generated short script with OpenAI");
        return { ...generated, source: "llm" };
      } catch (error: unknown) {
        logger.warn(error, "OpenAI script generation failed, using local fallback");
      }
    }

    logger.info("Generating short script with local fallback");
    return { ...generateLocalScript(trimmed), source: "local" };
  }

  private async generateWithGemini(prompt: string): Promise<CreateShortInput> {
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
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${SYSTEM_PROMPT}\n\nUser request:\n${prompt}` }],
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
        return parseGeneratedShort(text);
      } catch (error: unknown) {
        lastError = error;
        logger.warn({ model, error }, "Gemini model failed");
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini generation failed");
  }

  private async generateWithOpenAI(prompt: string): Promise<CreateShortInput> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: this.config.openaiModel,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
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
    return parseGeneratedShort(text);
  }
}

export function parseGeneratedShort(raw: string): CreateShortInput {
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText) as {
    scenes?: {
      text?: unknown;
      searchTerms?: unknown;
      overlayText?: unknown;
      exampleCard?: unknown;
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
      };
    })
    .filter((scene) => scene.text.length > 0)
    .slice(0, 4);

  if (scenes.length === 0) {
    throw new Error("Generated script had no scenes");
  }

  const config = parsed.config || {};
  const hookText =
    normalizeOptionalText(config.hookText, 60) ||
    makeHookText(scenes[0].text);
  const withCards = fillMissingExampleCards(scenes, hookText);
  const result = {
    scenes: pinTopicSearchTerms(withCards, hookText),
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
        makeEndCardText("", scenes.map((scene) => scene.text)),
      endCardCta:
        normalizeOptionalText(config.endCardCta, 40) || "Follow for more",
      endCardBeats:
        normalizeEndCardBeats(config.endCardBeats) ||
        makeEndCardBeats(withCards),
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
): SceneInput[] {
  const topic =
    topicVisualWord(hookText || "") ||
    topicVisualWord(...scenes.map((scene) => scene.text));
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
      ordered.push(["laptop", "city", "nature"][ordered.length]);
    }
    return { ...scene, searchTerms: ordered.slice(0, 3) };
  });
}

function splitIntoSceneTexts(prompt: string): string[] {
  const lines = prompt
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]\s+|[-*]\s+)/, "").trim())
    .filter(Boolean);
  if (lines.length >= 2 && /^\s*(?:\d+[.)]|[-*])/m.test(prompt)) {
    return lines.slice(0, 5).map(ensureSpokenSentence);
  }

  const sentences = prompt
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8);

  if (sentences.length >= 2) {
    return groupSentences(sentences, 3, 5).map(ensureSpokenSentence);
  }

  return expandTopic(cleanTopic(prompt));
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

function expandTopic(topic: string): string[] {
  const subject = topic || "this idea";
  return [
    `${capitalizePhrase(subject)} is simpler than it looks.`,
    `It shows up in ordinary moments if you watch for it.`,
    `Notice it once, and you will see it everywhere.`,
  ];
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

function clampCardBody(body: string): string {
  return body
    .replace(/\t/g, "  ")
    .split(/\r?\n/)
    .slice(0, 6)
    .map((line) => line.slice(0, 42))
    .join("\n")
    .slice(0, 280)
    .trim();
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
  const clamped = clampCardBody(body);
  const kind = looksLikeCode(clamped)
    ? "code"
    : obj.kind === "code"
      ? "code"
      : "fact";
  return {
    title: normalizeOptionalText(obj.title, 24),
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
