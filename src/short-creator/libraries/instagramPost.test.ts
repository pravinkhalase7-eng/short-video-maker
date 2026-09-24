import { expect, test } from "vitest";
import { buildInstagramPost } from "./instagramPost";

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
        text: "The answer is C. Check the captions for the explanation. Follow for more.",
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
        text: "The answer is B. Check the captions for the explanation. Follow for more.",
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
        text: "The answer is B. Check the captions for the explanation. Follow for more.",
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
