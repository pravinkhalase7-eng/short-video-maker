import { expect, test } from "vitest";
import { buildInstagramPost, hydrateVideoPostMeta } from "./instagramPost";

test("quiz posts get a title, explanation, and five hashtags", () => {
  const post = buildInstagramPost({
    id: "abc",
    prompt: "What is the output?\nx = [1, 2, 3]\nprint(x == [1, 2, 3])\nprint(x is [1, 2, 3])\nA) True, True\nB) False, False\nC) True, False\nD) False, True",
    scenes: [
      {
        text: "What is the output? Lock your guess. Comment A, B, C, or D.",
        searchTerms: ["python"],
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\nx = [1, 2, 3]\nprint(x == [1, 2, 3])\nprint(x is [1, 2, 3])\nA) True, True\nB) False, False\nC) True, False\nD) False, True",
        },
      },
      {
        text: "The answer is C. Did you fall for the trap? The trick is in the captions. Follow for more.",
        searchTerms: ["python"],
        overlayText: "C",
        exampleCard: {
          kind: "quiz",
          title: "C",
          body: "What is the output?\nx = [1, 2, 3]\nprint(x == [1, 2, 3])\nprint(x is [1, 2, 3])\nA) True, True\nB) False, False\nC) True, False\nD) False, True",
        },
      },
    ],
    config: { format: "quiz" },
  });

  expect(post.title).toMatch(/PYTHON/i);
  expect(post.title).toMatch(/output/i);
  expect(post.prompt).toContain("x is [1, 2, 3]");
  expect(post.explanation).toMatch(/answer is C/i);
  expect(post.explanation.toLowerCase()).toMatch(/identity|is compares/);
  expect(post.hashtags).toHaveLength(5);
  expect(post.hashtags.every((tag) => tag.startsWith("#"))).toBe(true);
  expect(post.instagramText).toContain(post.title);
  expect(post.instagramText).toContain(post.hashtags.join(" "));
  expect(post.caption.toLowerCase()).toMatch(/comment/);
  expect(post.instagramText.match(/What is the output\?/gi) || []).toHaveLength(1);
  expect(post.instagramText).not.toMatch(/\n{3,}/);
  expect(post.youtubeTitle.length).toBeLessThanOrEqual(100);
  expect(post.youtubeTitle).toMatch(/#python|#codingquiz|#programming/i);
  expect(post.youtubeDescription).toMatch(/answer is C/i);
  expect(post.youtubeDescription).toContain(post.hashtags.join(" "));
});

test("timeup quiz posts keep the on-video caption spoiler-free but copy the answer", () => {
  const post = buildInstagramPost({
    id: "timeup",
    prompt: "What is the output?\nprint(1)\nA) 1 ✅\nB) 2",
    scenes: [
      {
        text: "What is the output? Lock your guess.",
        searchTerms: ["python"],
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\nprint(1)\nA) 1 ✅\nB) 2\nC) 0\nD) Error",
        },
      },
      {
        text: "Time's up. Comment A, B, C, or D. Follow for more.",
        searchTerms: ["python"],
        overlayText: "TIMEUP",
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\nprint(1)\nA) 1 ✅\nB) 2\nC) 0\nD) Error",
        },
      },
    ],
    config: { format: "quiz", quizEnding: "timeup" },
  });

  expect(post.caption.toLowerCase()).toMatch(/time's up/);
  expect(post.caption).not.toMatch(/answer is [A-D]/i);
  expect(post.instagramText).toMatch(/answer is A/i);
  expect(post.youtubeTitle.length).toBeLessThanOrEqual(100);
  expect(post.youtubeDescription).toMatch(/answer is A/i);
});

test("set intersection quizzes explain the operator and the traps", () => {
  const post = buildInstagramPost({
    id: "set-and",
    prompt:
      "What is the output?\nx = {1, 2, 3}\ny = {3, 4, 5}\nprint(x & y)\nA) {1, 2, 3, 4, 5}\nB) {3}\nC) {1, 2}\nD) {4, 5}",
    scenes: [
      {
        text: "What is the output? Lock your guess. Comment A, B, C, or D.",
        searchTerms: ["python"],
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\nx = {1, 2, 3}\ny = {3, 4, 5}\nprint(x & y)\nA) {1, 2, 3, 4, 5}\nB) {3}\nC) {1, 2}\nD) {4, 5}",
        },
      },
      {
        text: "The answer is B. Did you fall for the trap? The trick is in the captions. Follow for more.",
        searchTerms: ["python"],
        overlayText: "B",
        exampleCard: {
          kind: "quiz",
          title: "B",
          body: "What is the output?\nx = {1, 2, 3}\ny = {3, 4, 5}\nprint(x & y)\nA) {1, 2, 3, 4, 5}\nB) {3}\nC) {1, 2}\nD) {4, 5}",
        },
      },
    ],
    config: { format: "quiz" },
  });

  expect(post.explanation).toMatch(/answer is B/i);
  expect(post.explanation.toLowerCase()).toMatch(/intersection/);
  expect(post.explanation).toMatch(/\{3\}/);
  expect(post.explanation).toMatch(/union/i);
  expect(post.explanation).toMatch(/C is x/);
  expect(post.explanation).toMatch(/D is y/);
  expect(post.explanation).not.toMatch(/A is y/);
  expect(post.explanation.length).toBeGreaterThan(120);
});

test("list comprehensions get a beginner explanation", () => {
  const post = buildInstagramPost({
    id: "odds",
    prompt:
      "What is the output?\nprint([i for i in range(5) if i % 2])\nA) [0, 2, 4]\nB) [1, 3]\nC) [0, 1, 2, 3, 4]\nD) [2, 4]",
    scenes: [
      {
        text: "What is the output? Lock your guess. Comment A, B, C, or D.",
        searchTerms: ["python"],
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\nprint([i for i in range(5) if i % 2])\nA) [0, 2, 4]\nB) [1, 3]\nC) [0, 1, 2, 3, 4]\nD) [2, 4]",
        },
      },
      {
        text: "The answer is B. Did you fall for the trap? The trick is in the captions. Follow for more.",
        searchTerms: ["python"],
        overlayText: "B",
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\nprint([i for i in range(5) if i % 2])\nA) [0, 2, 4]\nB) [1, 3]\nC) [0, 1, 2, 3, 4]\nD) [2, 4]",
        },
      },
    ],
    config: { format: "quiz" },
  });

  expect(post.explanation).toMatch(/answer is B/i);
  expect(post.explanation.toLowerCase()).toMatch(/odd/);
  expect(post.explanation).toMatch(/1 and 3/);
  expect(post.explanation.toLowerCase()).toMatch(/even/);
  expect(post.explanation.toLowerCase()).not.toMatch(/walk the snippet/);
  expect(post.explanation.toLowerCase()).not.toMatch(/operator or grouping/);
});

test("list repetition quizzes explain * copies the list", () => {
  const post = buildInstagramPost({
    id: "list-star",
    prompt:
      "What is the output?\na = [1, 2, 3]\nprint(a * 2)\nA) [2, 4, 6]\nB) [1, 2, 3, 1, 2, 3]\nC) [1, 2, 3, 2]\nD) Error",
    scenes: [
      {
        text: "What is the output? Lock your guess. Comment A, B, C, or D.",
        searchTerms: ["python"],
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\na = [1, 2, 3]\nprint(a * 2)\nA) [2, 4, 6]\nB) [1, 2, 3, 1, 2, 3]\nC) [1, 2, 3, 2]\nD) Error",
        },
      },
      {
        text: "The answer is B. Did you fall for the trap? The trick is in the captions. Follow for more.",
        searchTerms: ["python"],
        overlayText: "B",
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\na = [1, 2, 3]\nprint(a * 2)\nA) [2, 4, 6]\nB) [1, 2, 3, 1, 2, 3]\nC) [1, 2, 3, 2]\nD) Error",
        },
      },
    ],
    config: { format: "quiz" },
  });

  expect(post.explanation).toMatch(/answer is B/i);
  expect(post.explanation.toLowerCase()).toMatch(/repeat/);
  expect(post.explanation).toMatch(/\[1, 2, 3, 1, 2, 3\]/);
  expect(post.explanation.toLowerCase()).toMatch(/multipl/);
  expect(post.explanation.toLowerCase()).not.toMatch(/different condition/);
  expect(post.explanation.toLowerCase()).not.toMatch(/printed expression is a \* 2/);
});

test("provided LLM explanation wins over the heuristic fallback", () => {
  const post = buildInstagramPost({
    id: "llm",
    prompt: "What is the output?\na = [1, 2, 3]\nprint(a * 2)\nA) [2, 4, 6]\nB) [1, 2, 3, 1, 2, 3]\nC) [1, 2, 3, 2]\nD) Error",
    explanation:
      "The answer is B. Star on a list copies the whole list, so [1, 2, 3] * 2 is [1, 2, 3, 1, 2, 3]. A is the usual trap: people think each number is doubled.",
    scenes: [
      {
        text: "What is the output?",
        searchTerms: ["python"],
        overlayText: "B",
        exampleCard: {
          kind: "quiz",
          title: "Python Quiz",
          body: "What is the output?\na = [1, 2, 3]\nprint(a * 2)\nA) [2, 4, 6]\nB) [1, 2, 3, 1, 2, 3]\nC) [1, 2, 3, 2]\nD) Error",
        },
      },
    ],
    config: { format: "quiz" },
  });

  expect(post.explanation).toMatch(/Star on a list copies/);
  expect(post.explanation).toMatch(/usual trap/);
});

test("hydrate rebuilds Instagram and YouTube copy from the saved explanation", () => {
  const hydrated = hydrateVideoPostMeta({
    id: "old",
    prompt: "quiz",
    createdAt: "2026-01-01",
    title: "PYTHON Quiz: What is the output?",
    caption: "Time's up. Comment A, B, C, or D. Follow for more.",
    explanation: "The answer is C. is compares identity, not values.",
    hashtags: ["#python", "#codingquiz", "#programming", "#techtok", "#100daysofcode"],
    instagramText: "PYTHON Quiz: What is the output?\n\nTime's up.",
    youtubeTitle: "",
    youtubeDescription: "",
  });

  expect(hydrated.instagramText).toMatch(/answer is C/i);
  expect(hydrated.youtubeTitle.length).toBeLessThanOrEqual(100);
  expect(hydrated.youtubeTitle).toMatch(/#python|#codingquiz/i);
  expect(hydrated.youtubeDescription).toMatch(/answer is C/i);
  expect(hydrated.youtubeDescription).toContain("#python");
});

test("hydrate prefers the pasted Answer: C over a saved B explanation", () => {
  const prompt = `What is the output?

a = [1, 2, 3]
b = a

b.append(4)

print(a)

A) [1, 2, 3]
B) [4]
C) [1, 2, 3, 4]
D) Error

Answer: C) [1, 2, 3, 4]`;
  const hydrated = hydrateVideoPostMeta({
    id: "cmun797vo00090qnu3obm65p0",
    prompt,
    format: "quiz",
    createdAt: "2026-09-29T21:40:04.624Z",
    title: "PYTHON Quiz: What is the output?",
    caption: "Time's up. Comment A, B, C, or D. Follow for more.",
    explanation:
      "The answer is B. The code creates a list named a and makes variable b point to that same list. Appending the number 4 updates the list so that printing variable a outputs [4]. Option C is the most tempting wrong answer because people assume the list keeps its original numbers 1, 2, and 3 alongside the new number.",
    hashtags: ["#python", "#learnpython", "#codingquiz", "#programming", "#techtok"],
    instagramText: "The answer is B.",
    youtubeTitle: "",
    youtubeDescription: "",
  });

  expect(hydrated.explanation).toMatch(/answer is C/i);
  expect(hydrated.explanation).toMatch(/\[1, 2, 3, 4\]/);
  expect(hydrated.explanation).not.toMatch(/outputs \[4\]/);
  expect(hydrated.instagramText).toMatch(/answer is C/i);
});
