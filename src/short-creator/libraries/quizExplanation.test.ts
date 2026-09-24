import { expect, test } from "vitest";
import {
  llmQuizExplanation,
  quizExplanationPrompt,
  sanitizeQuizExplanation,
} from "./quizExplanation";

test("the LLM prompt asks for a beginner why, not a regex trap", () => {
  const prompt = quizExplanationPrompt({
    question: "What is the output?",
    code: "a = [1, 2, 3]\nprint(a * 2)",
    options: "A) [2, 4, 6]\nB) [1, 2, 3, 1, 2, 3]\nC) [1, 2, 3, 2]\nD) Error",
    answer: "B",
    winning: "[1, 2, 3, 1, 2, 3]",
  });
  expect(prompt).toMatch(/Correct answer: B/);
  expect(prompt).toMatch(/plain English/);
  expect(prompt).toMatch(/tempting wrong option/);
  expect(prompt).not.toMatch(/2,\\s\\*4/);
});

test("sanitize keeps the given letter and strips hashtags", () => {
  const text = sanitizeQuizExplanation(
    "Sure!\nThe answer is A. Actually list star repeats the list twice so you see 1 2 3 twice. #python #code",
    "B",
  );
  expect(text).toMatch(/^The answer is B\./);
  expect(text).not.toMatch(/#python/);
  expect(text?.toLowerCase()).toMatch(/repeats/);
});

test("explanation generation refuses to skip Gemini", async () => {
  await expect(
    llmQuizExplanation(
      { geminiApiKey: undefined } as never,
      {
        question: "What is the output?",
        code: "print(1)",
        options: "A) 1\nB) 2",
        answer: "A",
        winning: "1",
      },
    ),
  ).rejects.toThrow(/GEMINI_API_KEY/);
});
