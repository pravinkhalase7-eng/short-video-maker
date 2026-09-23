import { expect, test } from "vitest";
import {
  generateLocalScript,
  parseGeneratedShort,
  pinTopicSearchTerms,
  scriptLimits,
} from "./PromptScriptGenerator";
import {
  MusicMoodEnum,
  OrientationEnum,
  VoiceEnum,
  MusicVolumeEnum,
} from "../../types/shorts";
import { getDuckedMusicVolume, getOverlayTiming, clipCaptionPageToSafeWindow, getSceneSequence, stretchSceneDurations, clipCountForDuration, splitClipWindows, isPunchCaptionWord, sceneClips, isQuizQuestionCard, isQuizAnswerCard, captionsFromSpeech } from "../../components/utils";

test("local generator expands a short topic into scenes and search terms", () => {
  const result = generateLocalScript(
    "Make a chill morning coffee video for tiktok with a female voice",
  );

  expect(result.scenes.length).toBeGreaterThanOrEqual(3);
  expect(result.scenes[0].text.length).toBeGreaterThan(8);
  expect(result.scenes[0].searchTerms.length).toBeGreaterThanOrEqual(2);
  expect(result.config.music).toBe(MusicMoodEnum.chill);
  expect(result.config.voice).toBe(VoiceEnum.af_heart);
  expect(result.config.orientation).toBe(OrientationEnum.portrait);
  expect(result.config.musicVolume).toBe(MusicVolumeEnum.low);
  expect(result.config.hookText).toBeTruthy();
  expect(result.config.endCardText).toBeTruthy();
  expect(result.config.endCardCta).toBe("Follow for more");
  expect(result.scenes[0].text.toLowerCase().startsWith("let's talk")).toBe(
    false,
  );
  expect(result.scenes.every((scene) => scene.overlayText)).toBe(true);
});

test("local generator uses numbered lines as scenes", () => {
  const result = generateLocalScript(`1. Wake up before sunrise.
2. Pour a fresh cup of coffee.
3. Start the day with a clear plan.`);

  expect(result.scenes.map((scene) => scene.text)).toEqual([
    "Wake up before sunrise.",
    "Pour a fresh cup of coffee.",
    "Start the day with a clear plan.",
  ]);
  expect(result.scenes[1].overlayText).toBe("COFFEE");
});

test("local generator infers british male voice and landscape", () => {
  const result = generateLocalScript(
    "A landscape video about ocean storms, british male voice, dark music",
  );

  expect(result.config.voice).toBe(VoiceEnum.bm_george);
  expect(result.config.orientation).toBe(OrientationEnum.landscape);
  expect(result.config.music).toBe(MusicMoodEnum.dark);
});

test("parseGeneratedShort accepts fenced JSON and clamps invalid enums", () => {
  const result = parseGeneratedShort(`\`\`\`json
{
  "scenes": [
    { "text": "Hello from the city.", "searchTerms": ["city skyline", "street"], "overlayText": "24/7" }
  ],
  "config": {
    "music": "not-a-mood",
    "voice": "robot",
    "orientation": "portrait",
    "musicVolume": "low",
    "paddingBack": 1500,
    "hookText": "City never sleeps",
    "endCardText": "Look up once tonight."
  }
}
\`\`\``);

  expect(result.scenes).toHaveLength(1);
  expect(result.scenes[0].searchTerms.every((term) => !term.includes(" "))).toBe(
    true,
  );
  expect(result.config.music).toBe(MusicMoodEnum.chill);
  expect(result.config.voice).toBe(VoiceEnum.af_heart);
  expect(result.config.hookText).toBe("City never sleeps");
  expect(result.config.endCardText).toBe("Look up once tonight.");
  expect(result.config.endCardCta).toBe("Follow for more");
  expect(result.scenes[0].overlayText).toBe("24/7");
});

test("parseGeneratedShort infers overlay text from a spoken number", () => {
  const result = parseGeneratedShort(`{
    "scenes": [
      { "text": "Caffeine peaks in 20 minutes.", "searchTerms": ["coffee", "clock"] }
    ],
    "config": {}
  }`);

  expect(result.scenes[0].overlayText).toBe("20");
});

test("overlay timing keeps the hook before the end card", () => {
  const timing = getOverlayTiming({
    durationMs: 10000,
    paddingBack: 2500,
    hookDurationMs: 2200,
    fps: 25,
  });

  expect(timing.hookFrames).toBe(55);
  expect(timing.endCardFrames).toBe(63);
  expect(timing.endCardFrom).toBe(250 - 63);
  expect(timing.hookFrames + timing.endCardFrames).toBeLessThanOrEqual(250);
});

test("music ducks under speech and rises on the end card", () => {
  const endCardFrom = 200;
  const ducked = getDuckedMusicVolume({
    frame: 40,
    baseVolume: 0.2,
    muted: false,
    endCardFrom,
  });
  const risen = getDuckedMusicVolume({
    frame: 210,
    baseVolume: 0.2,
    muted: false,
    endCardFrom,
  });
  const muted = getDuckedMusicVolume({
    frame: 40,
    baseVolume: 0.2,
    muted: true,
    endCardFrom,
  });

  expect(ducked).toBeCloseTo(0.076, 3);
  expect(risen).toBe(0.2);
  expect(muted).toBe(0);
});

test("pins the hook topic as the first Pexels search term and drops negated words", () => {
  const result = parseGeneratedShort(`{
    "scenes": [
      {
        "text": "Archaeologists have found 3000-year-old pots in tombs.",
        "searchTerms": ["tombs", "pots"]
      },
      {
        "text": "There is no water, so mold cannot grow.",
        "searchTerms": ["water", "mold"]
      }
    ],
    "config": {
      "hookText": "Why does honey never actually expire"
    }
  }`);

  expect(result.scenes[0].searchTerms[0]).toBe("honey");
  expect(result.scenes[1].searchTerms[0]).toBe("honey");
  expect(result.scenes[1].searchTerms).not.toContain("water");
});

test("pinTopicSearchTerms keeps honey first even when other terms exist", () => {
  const scenes = pinTopicSearchTerms(
    [
      {
        text: "There is no water for bacteria.",
        searchTerms: ["water", "tombs"],
      },
    ],
    "Why does honey never expire",
  );

  expect(scenes[0].searchTerms[0]).toBe("honey");
  expect(scenes[0].searchTerms).not.toContain("water");
});

test("kiwi hook pins kiwi instead of filler words like should", () => {
  const result = parseGeneratedShort(`{
    "scenes": [
      {
        "text": "Eating one fresh kiwi delivers more vitamin C than an orange.",
        "searchTerms": ["should", "kiwi", "fruit"]
      }
    ],
    "config": {
      "hookText": "WHY YOU SHOULD EAT KIWI DAILY"
    }
  }`);

  expect(result.scenes[0].searchTerms[0]).toBe("kiwi");
  expect(result.scenes[0].searchTerms).not.toContain("should");
});

test("banana health hooks search fruit, not body B-roll", () => {
  const result = parseGeneratedShort(
    `{
    "scenes": [
      {
        "text": "One banana delivers 450mg of potassium to stop cramps fast.",
        "searchTerms": ["body", "muscle", "woman"]
      }
    ],
    "config": {
      "hookText": "YOUR BODY ON ONE BANANA"
    }
  }`,
    "how banana helps",
  );

  expect(result.scenes[0].searchTerms[0]).toBe("banana");
  expect(result.scenes[0].searchTerms).not.toContain("body");
  expect(result.scenes[0].searchTerms).not.toContain("woman");
  expect(result.scenes[0].searchTerms).not.toContain("muscle");
});

test("maps abstract topics like agentic AI to filmable Pexels terms", () => {
  const result = parseGeneratedShort(`{
    "scenes": [
      {
        "text": "Agentic AI moves beyond chatbots by taking independent action.",
        "searchTerms": ["agentic", "robot", "computer"]
      }
    ],
    "config": {
      "hookText": "AGENTIC AI WORKS WHILE YOU SLEEP"
    }
  }`);

  expect(result.scenes[0].searchTerms).not.toContain("agentic");
  expect(result.scenes[0].searchTerms[0]).toMatch(/robot|laptop|coding|code/);
});

test("java lambda scripts get before/after code cards and recap beats", () => {
  const result = generateLocalScript("what is lambda in java8");

  expect(result.scenes[0].exampleCard?.kind).toBe("code");
  expect(result.scenes[0].exampleCard?.title).toBe("BEFORE");
  expect(result.scenes[0].exampleCard?.body).toContain("new Action");
  expect(result.scenes[1].exampleCard?.title).toBe("AFTER");
  expect(result.scenes[1].exampleCard?.body).toContain("->");
  expect(result.config.endCardBeats).toEqual(
    expect.arrayContaining(["BEFORE", "AFTER"]),
  );
  expect(result.scenes[0].searchTerms[0]).toMatch(/code|laptop|keyboard/);
});

test("parseGeneratedShort keeps a provided example card", () => {
  const result = parseGeneratedShort(`{
    "scenes": [
      {
        "text": "Lambdas replace anonymous inner classes.",
        "searchTerms": ["java", "code"],
        "exampleCard": {
          "title": "AFTER",
          "body": "() -> doWork()",
          "kind": "code"
        }
      }
    ],
    "config": {
      "hookText": "Java 8 Lambdas Changed Everything"
    }
  }`);

  expect(result.scenes[0].exampleCard).toEqual({
    title: "AFTER",
    body: "() -> doWork()",
    kind: "code",
  });
});

test("numbered facts get a fact card", () => {
  const result = parseGeneratedShort(`{
    "scenes": [
      { "text": "Eating one kiwi delivers 230% of your vitamin C.", "searchTerms": ["kiwi", "fruit"] }
    ],
    "config": { "hookText": "Why eating kiwi changes your health" }
  }`);

  expect(result.scenes[0].exampleCard?.kind).toBe("fact");
  expect(result.scenes[0].exampleCard?.title).toBe("230%");
});

test("stream method cards are treated as code even if marked fact", () => {
  const result = parseGeneratedShort(`{
    "scenes": [
      {
        "text": "Java map transforms each stream element.",
        "searchTerms": ["code", "laptop"],
        "exampleCard": {
          "title": "MAP",
          "body": "list.stream()\\n  .map(String::trim)",
          "kind": "fact"
        }
      }
    ],
    "config": { "hookText": "Java map vs flatMap" }
  }`);

  expect(result.scenes[0].exampleCard?.kind).toBe("code");
  expect(result.scenes[0].exampleCard?.body).toContain(".map");
});

test("captions stay off during the hook and end card", () => {
  const hidden = clipCaptionPageToSafeWindow({
    pageStartMs: 0,
    pageEndMs: 800,
    sceneStartFrame: 0,
    fps: 25,
    hookFrames: 55,
    endCardFrom: 200,
  });
  const visible = clipCaptionPageToSafeWindow({
    pageStartMs: 2400,
    pageEndMs: 3600,
    sceneStartFrame: 0,
    fps: 25,
    hookFrames: 55,
    endCardFrom: 200,
  });
  const endCard = clipCaptionPageToSafeWindow({
    pageStartMs: 0,
    pageEndMs: 1000,
    sceneStartFrame: 200,
    fps: 25,
    hookFrames: 55,
    endCardFrom: 200,
  });

  expect(hidden).toBeNull();
  expect(visible).toEqual({ from: 60, durationInFrames: 30 });
  expect(endCard).toBeNull();
});

test("first scene holds the hook before later scenes start", () => {
  const scenes = [
    { audio: { duration: 4 } },
    { audio: { duration: 5 } },
  ];
  const first = getSceneSequence({ scenes, index: 0, fps: 25, hookFrames: 55 });
  const second = getSceneSequence({ scenes, index: 1, fps: 25, hookFrames: 55 });

  expect(first.startFrame).toBe(0);
  expect(first.durationInFrames).toBe(100 + 55);
  expect(second.startFrame).toBe(100 + 55);
  expect(second.durationInFrames).toBe(125);
});

test("60 second stories use more scenes than the 30 second default", () => {
  const short = generateLocalScript("how banana helps", {
    targetDurationSec: 30,
    format: "story",
  });
  const longer = generateLocalScript("how banana helps", {
    targetDurationSec: 60,
    format: "story",
  });

  expect(short.config.targetDurationSec).toBe(30);
  expect(longer.config.targetDurationSec).toBe(60);
  expect(short.scenes.length).toBeGreaterThanOrEqual(
    scriptLimits({ targetDurationSec: 30, format: "story" }).minScenes,
  );
  expect(longer.scenes.length).toBeGreaterThan(short.scenes.length);
});

test("quiz format writes question and answer scenes with think pauses", () => {
  const result = generateLocalScript("how banana helps", {
    targetDurationSec: 30,
    format: "quiz",
  });

  expect(result.config.format).toBe("quiz");
  expect(result.scenes).toHaveLength(4);
  expect(result.scenes[0].exampleCard?.kind).toBe("quiz");
  expect(result.scenes[0].exampleCard?.title).toBe("Q1");
  expect(result.scenes[0].exampleCard?.body).toMatch(/A\)/);
  expect(result.scenes[0].holdMs).toBe(3000);
  expect(result.scenes[1].exampleCard?.title).toMatch(/^[A-C]$/);
  expect(result.scenes[0].searchTerms[0]).toBe("banana");
  expect(result.config.endCardText).toBe("How many did you get right?");
});

test("parseGeneratedShort keeps more than four scenes for a 60 second target", () => {
  const scenes = Array.from({ length: 6 }, (_, index) => ({
    text: `Banana fact number ${index + 1} keeps the topic on fruit.`,
    searchTerms: ["banana", "fruit"],
  }));
  const result = parseGeneratedShort(
    JSON.stringify({
      scenes,
      config: { hookText: "QUIZ BANANAS" },
    }),
    "how banana helps",
    { targetDurationSec: 60, format: "story" },
  );

  expect(result.scenes).toHaveLength(6);
  expect(result.config.targetDurationSec).toBe(60);
});

test("stretchSceneDurations pads short speech up to the target length", () => {
  const stretched = stretchSceneDurations([5, 5, 5], 30, 2.2);
  const total = stretched.reduce((sum, value) => sum + value, 0);

  expect(total + 2.2).toBeCloseTo(30, 5);
  expect(stretched.every((value) => value > 5)).toBe(true);
});

test("longer scenes split into two or three B-roll windows", () => {
  expect(clipCountForDuration(8)).toBe(3);
  expect(clipCountForDuration(4)).toBe(2);
  expect(clipCountForDuration(2)).toBe(1);
  const windows = splitClipWindows(90, 3);
  expect(windows).toHaveLength(3);
  expect(windows.reduce((sum, window) => sum + window.durationInFrames, 0)).toBe(
    90,
  );
  expect(windows[1].from).toBe(windows[0].durationInFrames);
});

test("kinetic captions punch numbers and long words", () => {
  expect(isPunchCaptionWord("450mg")).toBe(true);
  expect(isPunchCaptionWord("banana")).toBe(false);
  expect(isPunchCaptionWord("potassium")).toBe(true);
});

test("captionsFromSpeech maps spoken words onto audio duration", () => {
  const captions = captionsFromSpeech("One banana helps", 2);
  expect(captions).toHaveLength(3);
  expect(captions[0].text).toBe("One");
  expect(captions[2].endMs).toBe(2000);
});

test("quiz cards are detected for countdown and answer freeze", () => {
  expect(isQuizQuestionCard({ kind: "quiz", title: "Q1" })).toBe(true);
  expect(isQuizAnswerCard({ kind: "quiz", title: "B" })).toBe(true);
  expect(
    sceneClips({
      video: "a.mp4",
      clips: [
        { url: "a.mp4" },
        { url: "b.mp4" },
      ],
    }),
  ).toHaveLength(2);
});
