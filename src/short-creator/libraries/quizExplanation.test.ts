import { expect, test } from "vitest";
import {
  llmQuizExplanation,
  quizExplanationPrompt,
  quizFactsFromScenes,
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

test("timeup overlay does not default the caption letter to B when the prompt marked C", () => {
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
  const body = `What is the output?
a = [1, 2, 3]
b = a
b.append(4)
print(a)
A) [1, 2, 3]
B) [4]
C) [1, 2, 3, 4]
D) Error`;
  const facts = quizFactsFromScenes({
    prompt,
    scenes: [
      {
        text: "What is the output? Lock your guess.",
        searchTerms: ["python"],
        exampleCard: { kind: "quiz", title: "Python Quiz", body },
      },
      {
        text: "Time's up. Comment A, B, C, or D. Follow for more.",
        searchTerms: ["python"],
        overlayText: "TIMEUP",
        exampleCard: { kind: "quiz", title: "Quiz", body },
      },
    ],
    config: { format: "quiz", quizEnding: "timeup" },
  });
  expect(facts?.answer).toBe("C");
  expect(facts?.winning).toBe("[1, 2, 3, 4]");
});
