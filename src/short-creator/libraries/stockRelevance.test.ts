import { expect, test } from "vitest";
import { matchesSearchText, searchQueriesFor } from "./stockRelevance";

test("matchesSearchText requires every query word", () => {
  expect(
    matchesSearchText(
      "https://www.pexels.com/video/sliced-kiwi-fruit-on-a-plate-123",
      "kiwi fruit",
    ),
  ).toBe(true);
  expect(
    matchesSearchText(
      "https://www.pexels.com/video/woman-taking-bowl-of-apples-6989166",
      "kiwi",
    ),
  ).toBe(false);
  expect(matchesSearchText("kiwi, fruit, food, green", "kiwi fruit")).toBe(true);
});

test("searchQueriesFor puts the compound topic first", () => {
  expect(searchQueriesFor(["kiwi", "fruit", "slice"])).toEqual([
    "kiwi fruit",
    "kiwi",
    "fruit",
    "slice",
  ]);
});
