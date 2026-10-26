import { expect, test } from "vitest";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { BrollCache, brollSearchKey } from "./BrollCache";

function tempCache() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "broll-cache-"));
  return { dir, cache: new BrollCache(dir) };
}

test("broll search keys ignore term order", () => {
  expect(brollSearchKey("portrait", ["laptop", "python"])).toBe(
    brollSearchKey("portrait", ["python", "laptop"]),
  );
});

test("saved stills are reused for the same search terms", () => {
  const { dir, cache } = tempCache();
  const source = path.join(dir, "still.jpg");
  fs.writeFileSync(source, "jpeg-bytes");
  cache.put("pexels-1", "image", source);
  cache.remember("portrait", ["python", "code"], ["pexels-1"]);

  const hits = cache.take("portrait", ["code", "python"], 1, []);
  expect(hits).toHaveLength(1);
  expect(hits[0].id).toBe("pexels-1");
  expect(fs.readFileSync(hits[0].path, "utf8")).toBe("jpeg-bytes");
  fs.removeSync(dir);
});

test("excluded clip ids are skipped so scenes can still vary", () => {
  const { dir, cache } = tempCache();
  const first = path.join(dir, "a.jpg");
  const second = path.join(dir, "b.jpg");
  fs.writeFileSync(first, "a");
  fs.writeFileSync(second, "b");
  cache.put("clip-a", "image", first);
  cache.put("clip-b", "image", second);
  cache.remember("portrait", ["python"], ["clip-a", "clip-b"]);

  const hits = cache.take("portrait", ["python"], 1, ["clip-a"]);
  expect(hits.map((clip) => clip.id)).toEqual(["clip-b"]);
  fs.removeSync(dir);
});

test("list returns a public link and search terms for each saved clip", () => {
  const { dir, cache } = tempCache();
  const source = path.join(dir, "still.jpg");
  fs.writeFileSync(source, "jpeg-bytes");
  cache.put("pexels-9", "image", source);
  cache.remember("portrait", ["python", "laptop"], ["pexels-9"]);

  const listed = cache.list();
  expect(listed).toHaveLength(1);
  expect(listed[0].id).toBe("pexels-9");
  expect(listed[0].url).toBe("/api/broll/pexels-9");
  expect(listed[0].terms.sort()).toEqual(["laptop", "python"]);
  fs.removeSync(dir);
});
