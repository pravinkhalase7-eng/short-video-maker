process.env.LOG_LEVEL = "debug";

import nock from "nock";
import { PexelsAPI, pickPexelsVideoFile } from "./Pexels";
import { test, assert, expect } from "vitest";
import fs from "fs-extra";
import path from "path";
import { OrientationEnum } from "../../types/shorts";

test("test pexels", async () => {
  const mockResponse = fs.readFileSync(
    path.resolve("__mocks__/pexels-response.json"),
    "utf-8",
  );
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .reply(200, mockResponse);
  const pexels = new PexelsAPI("asdf");
  const video = await pexels.findVideo(["dog"], 2.4, []);
  console.log(video);
  assert.isObject(video, "Video should be an object");
});

test("should time out", async () => {
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .delay(1000)
    .times(30)
    .reply(200, {});
  expect(async () => {
    const pexels = new PexelsAPI("asdf");
    await pexels.findVideo(["dog"], 2.4, [], OrientationEnum.portrait, 100);
  }).rejects.toThrow(
    expect.objectContaining({
      name: "TimeoutError",
    }),
  );
});

test("should retry 3 times", async () => {
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .delay(1000)
    .times(2)
    .reply(200, {});
  const mockResponse = fs.readFileSync(
    path.resolve("__mocks__/pexels-response.json"),
    "utf-8",
  );
  nock("https://api.pexels.com")
    .get(/videos\/search/)
    .reply(200, mockResponse);

  const pexels = new PexelsAPI("asdf");
  const video = await pexels.findVideo(["dog"], 2.4, []);
  console.log(video);
  assert.isObject(video, "Video should be an object");
});

test("picks 1080p instead of UHD when both files exist", () => {
  const picked = pickPexelsVideoFile({
    video: {
      id: "8720756",
      duration: 20,
      video_files: [
        {
          fps: 25,
          quality: "uhd",
          width: 2160,
          height: 4096,
          link: "https://videos.pexels.com/uhd.mp4",
        },
        {
          fps: 25,
          quality: "hd",
          width: 1080,
          height: 1920,
          link: "https://videos.pexels.com/hd.mp4",
        },
      ],
    },
    excludeIds: [],
    minDurationSeconds: 6,
    orientation: OrientationEnum.portrait,
    requiredVideoWidth: 1080,
    requiredVideoHeight: 1920,
  });

  expect(picked?.url).toBe("https://videos.pexels.com/hd.mp4");
  expect(picked?.width).toBe(1080);
});
