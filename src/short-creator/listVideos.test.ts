import { expect, test } from "vitest";
import { compareVideosLatestFirst } from "./ShortCreator";

test("video list sorts newest first", () => {
  const videos = [
    { id: "old", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "new", createdAt: "2026-10-24T18:00:00.000Z" },
    { id: "mid", createdAt: "2026-06-01T00:00:00.000Z" },
  ].sort(compareVideosLatestFirst);
  expect(videos.map((video) => video.id)).toEqual(["new", "mid", "old"]);
});
