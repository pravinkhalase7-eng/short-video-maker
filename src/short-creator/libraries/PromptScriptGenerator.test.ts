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
import { getDuckedMusicVolume, getOverlayTiming, clipCaptionPageToSafeWindow, getSceneSequence, stretchSceneDurations, clipCountForDuration, splitClipWindows, isPunchCaptionWord, sceneClips, isQuizQuestionCard, isQuizAnswerCard, captionsFromSpeech, parseQuizSheet, parsePastedQuiz, usesHardcodedWorksheet, quizOptionReveal, quizCountdownTiming, quizCardTitle, quizSeriesBadge } from "../../components/utils";

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
  expect(
    getDuckedMusicVolume({
      frame: 40,
      baseVolume: 0.2,
      muted: false,
      endCardFrom,
      duckRanges: [{ from: 30, durationInFrames: 20 }],
    }),
  ).toBeCloseTo(0.076 * 0.18, 3);
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

test("quiz format writes one question worksheet then the answer", () => {
  const result = generateLocalScript("how banana helps", {
    targetDurationSec: 30,
    format: "quiz",
  });

  expect(result.config.format).toBe("quiz");
  expect(result.scenes).toHaveLength(2);
  expect(result.scenes[0].exampleCard?.kind).toBe("quiz");
  expect(result.scenes[0].exampleCard?.title).toMatch(/Quiz$/i);
  expect(result.scenes[0].exampleCard?.body).toMatch(/A\)/);
  expect(result.scenes[0].exampleCard?.body).toMatch(/D\)/);
  expect(result.scenes[0].exampleCard?.body).toMatch(/\?/);
  expect(result.scenes[0].holdMs).toBe(11000);
  expect(result.scenes[1].exampleCard?.title).toMatch(/Quiz$/i);
  expect(result.scenes[1].overlayText).toMatch(/^[A-D]$/);
  expect(result.scenes[1].exampleCard?.body).toMatch(/A\)/);
  expect(result.scenes[0].searchTerms[0]).toBe("banana");
  expect(result.config.hookText).toBeUndefined();
  expect(result.config.hookDurationMs).toBe(0);
  expect(result.config.endCardText).toBe("Did you get it right?");
  expect(result.config.endCardCta).toBe("Follow for more");
  expect(result.config.music).toBe(MusicMoodEnum.funny);
  expect(result.config.musicVolume).toBe(MusicVolumeEnum.medium);
});

test("code quizzes ask for program output, not theory", () => {
  const result = generateLocalScript("Java 8 lambdas", {
    targetDurationSec: 30,
    format: "quiz",
  });
  const body = result.scenes[0].exampleCard?.body || "";
  expect(body).toMatch(/Predicate|System\.out|->/);
  expect(body).toMatch(/A\)/);
  expect(result.scenes[0].text.toLowerCase()).toMatch(/comment/);
  expect(result.scenes[0].text.toLowerCase()).toMatch(/what is the output/);
  expect(result.scenes[0].text.toLowerCase()).not.toMatch(/editor|snippet/);
  expect(result.scenes[0].text).not.toMatch(/A:\s*1|A\)\s*1/i);
  expect(result.scenes[1].text.toLowerCase()).toMatch(/check the captions/);
  expect(result.scenes[1].text.toLowerCase()).not.toMatch(/hint:/);
  const sheet = parseQuizSheet({
    title: result.scenes[0].exampleCard?.title,
    body,
  });
  expect(sheet.question.toLowerCase()).toMatch(/output/);
  expect(sheet.code).toBeTruthy();
  expect(sheet.options).toHaveLength(4);
  expect(sheet.options.map((option) => option.letter).join("")).toBe("ABCD");
});

const PASTED_LIST_QUIZ = `1. What is the output?
x = [1, 2, 3]
y = x
y.append(4)
print(x)

A) [1, 2, 3]
B) [1, 2, 3, 4]
C) [4, 1, 2, 3]
D) Error`;

test("pasted programming quizzes keep the snippet and solve it", () => {
  const sheet = parsePastedQuiz(PASTED_LIST_QUIZ);
  expect(sheet?.question).toMatch(/output/i);
  expect(sheet?.code).toContain("y.append(4)");
  expect(sheet?.options.map((option) => option.letter).join("")).toBe("ABCD");

  const result = generateLocalScript(PASTED_LIST_QUIZ, {
    targetDurationSec: 30,
    format: "story",
  });
  expect(result.config.format).toBe("quiz");
  expect(result.scenes[0].exampleCard?.body).toContain("y.append(4)");
  expect(result.scenes[0].exampleCard?.body).toContain("B) [1, 2, 3, 4]");
  expect(result.scenes[0].text).toMatch(/Lock your guess/);
  expect(result.scenes[0].text).toMatch(/Comment A, B, C, or D/);
  expect(result.scenes[0].text).not.toContain("append");
  expect(result.scenes[1].exampleCard?.title).toMatch(/Quiz$/i);
  expect(result.scenes[1].overlayText).toBe("B");
  expect(result.scenes[1].text).toMatch(/answer is B/i);
  expect(result.scenes[1].text.toLowerCase()).toMatch(/check the captions/);
  expect(result.scenes[1].text.toLowerCase()).not.toMatch(/hint:/);
  expect(result.scenes[1].text.toLowerCase()).toMatch(/follow for more/);
  expect(result.config.music).toBe(MusicMoodEnum.funny);
});

test("parseGeneratedShort pins a pasted quiz instead of the model worksheet", () => {
  const result = parseGeneratedShort(
    JSON.stringify({
      scenes: [
        {
          text: "Guess this.",
          searchTerms: ["code"],
          exampleCard: {
            kind: "quiz",
            title: "Invented Quiz",
            body: "What is 1+1?\nA) 1\nB) 2\nC) 3\nD) 4",
          },
        },
        {
          text: "The answer is B. Two.",
          overlayText: "B",
          exampleCard: {
            kind: "quiz",
            title: "B",
            body: "What is 1+1?\nA) 1\nB) 2\nC) 3\nD) 4",
          },
        },
      ],
    }),
    PASTED_LIST_QUIZ,
    { targetDurationSec: 30, format: "quiz" },
  );
  expect(result.scenes[0].exampleCard?.body).toContain("y.append(4)");
  expect(result.scenes[1].exampleCard?.title).toMatch(/Quiz$/i);
  expect(result.scenes[1].overlayText).toBe("B");
});

test("longer quiz videos still use a single question", () => {
  const result = generateLocalScript("USA geography", {
    targetDurationSec: 60,
    format: "quiz",
  });

  expect(result.scenes).toHaveLength(2);
  expect(result.scenes[0].holdMs).toBe(13000);
  expect(result.scenes[1].text.toLowerCase()).toContain("answer");
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
  expect(captions[0].startMs).toBeGreaterThan(0);
  expect(captions[2].endMs).toBe(2000);
  expect(captions[1].endMs - captions[1].startMs).toBeGreaterThan(
    captions[0].endMs - captions[0].startMs,
  );
});

test("captionsFromSpeech follows the detected speech window", () => {
  const captions = captionsFromSpeech("One banana helps", 2, {
    startSec: 0.2,
    endSec: 1.6,
  });
  expect(captions[0].startMs).toBe(200);
  expect(captions[2].endMs).toBe(1600);
});

test("quiz videos skip Pexels and use a hardcoded worksheet", () => {
  expect(usesHardcodedWorksheet({ format: "quiz" })).toBe(true);
  expect(usesHardcodedWorksheet({ format: "story" })).toBe(false);
  expect(
    usesHardcodedWorksheet({ format: "story" }, [
      { exampleCard: { kind: "quiz" } },
    ]),
  ).toBe(true);
});

test("quiz cards are detected for countdown and answer freeze", () => {
  expect(isQuizQuestionCard({ kind: "quiz", title: "USA Quiz" })).toBe(true);
  expect(isQuizQuestionCard({ kind: "quiz", title: "Q1" })).toBe(true);
  expect(isQuizAnswerCard({ kind: "quiz", title: "B" })).toBe(true);
  expect(isQuizQuestionCard({ kind: "quiz", title: "B" })).toBe(false);
  expect(
    isQuizAnswerCard({ kind: "quiz", title: "Python Quiz" }, "B"),
  ).toBe(true);
  expect(
    isQuizQuestionCard({ kind: "quiz", title: "Python Quiz" }, "B"),
  ).toBe(false);
  expect(
    quizSeriesBadge({
      title: "B",
      body: "What is the output?\nprint([i for i in range(5) if i % 2])",
    }),
  ).toBe("PYTHON");
  const sheet = parseQuizSheet({
    title: "USA Quiz",
    body: "Which U.S. state has the most people?\nA) Texas\nB) California\nC) Florida",
  });
  expect(sheet.heading).toBe("USA Quiz");
  expect(sheet.question).toMatch(/most people/);
  expect(sheet.options).toHaveLength(3);
  expect(sheet.options[1]).toEqual({ letter: "B", text: "California" });
  const codeSheet = parseQuizSheet({
    title: "Python OOP Quiz",
    body: "What is the output?\nclass A: x = 1\nclass B(A): pass\nA.x = 2\nprint(B.x)\nA) 1\nB) 2\nC) AttributeError\nD) None",
  });
  expect(codeSheet.code).toContain("A.x = 2");
  expect(codeSheet.code).toContain("print(B.x)");
  expect(codeSheet.options.map((option) => option.letter).join("")).toBe("ABCD");
  expect(codeSheet.options[0]).toEqual({ letter: "A", text: "1" });
  const mutableSheet = parseQuizSheet({
    title: "Python Quiz",
    body: "What is the output?\ndef func(a=[]):\n    a.append(1)\n    return a\nprint(func())\nprint(func())\nA) [1], [1]\nB) [1], [1, 1]\nC) [1, 1], [1, 1]\nD) Error",
  });
  expect(mutableSheet.question).toBe("What is the output?");
  expect(mutableSheet.code).toContain("return a");
  expect(mutableSheet.question.toLowerCase()).not.toContain("return");
  const mutableScript = generateLocalScript(
    `What is the output?
def func(a=[]):
    a.append(1)
    return a
print(func())
print(func())
A) [1], [1]
B) [1], [1, 1]
C) [1, 1], [1, 1]
D) Error`,
    { targetDurationSec: 30, format: "quiz" },
  );
  expect(mutableScript.scenes[0].text).toBe(
    "What is the output? Lock your guess. Comment A, B, C, or D.",
  );
  expect(mutableScript.scenes[0].text.toLowerCase()).not.toContain("return a");
  expect(
    quizSeriesBadge({
      title: "Python OOP Quiz",
      body: codeSheet.code,
    }),
  ).toBe("PYTHON");
  const reveal = quizOptionReveal({ fps: 30, delayFrames: 0 });
  expect(reveal.from).toBeGreaterThan(0);
  expect(reveal.step).toBeGreaterThanOrEqual(18);
  expect(quizCardTitle({ title: "Python Quiz" })).toBe("Python Quiz");
  expect(quizCardTitle({ title: "B" })).toBe("");
  const countdown = quizCountdownTiming({
    fps: 30,
    optionFrom: reveal.from,
    optionStep: reveal.step,
    optionCount: 4,
    sceneFrames: 450,
  });
  expect(countdown.from).toBe(360);
  expect(countdown.guessFrom).toBeLessThan(countdown.from);
  expect(countdown.guessDuration).toBeGreaterThanOrEqual(240);
  expect(countdown.tickDuration).toBe(0);
  expect(countdown.step).toBe(30);
  expect(countdown.durationInFrames).toBe(90);
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

