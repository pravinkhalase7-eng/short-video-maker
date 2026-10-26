import fs from "fs-extra";
import path from "path";
import type { OrientationEnum, Video } from "../../types/shorts";

export type CachedBroll = {
  id: string;
  kind: "video" | "image";
  file: string;
  path: string;
};

export type ListedBroll = {
  id: string;
  kind: "video" | "image";
  file: string;
  url: string;
  terms: string[];
  orientation?: string;
};

type IndexFile = {
  clips: Record<string, { id: string; kind: "video" | "image"; file: string }>;
  searches: Record<string, string[]>;
};

export function brollSearchKey(
  orientation: string,
  terms: string[],
): string {
  const normalized = terms
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return `${orientation}|${normalized.join(",")}`;
}

function safeId(id: string): string {
  return (id || "clip").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export class BrollCache {
  constructor(private dir: string) {
    fs.ensureDirSync(dir);
  }

  list(): ListedBroll[] {
    const index = this.readIndex();
    const termsById = new Map<string, Set<string>>();
    const orientationById = new Map<string, string>();
    for (const [key, ids] of Object.entries(index.searches)) {
      const [orientation, termBlob = ""] = key.split("|");
      const terms = termBlob.split(",").filter(Boolean);
      for (const id of ids) {
        if (orientation) {
          orientationById.set(id, orientation);
        }
        const set = termsById.get(id) ?? new Set<string>();
        for (const term of terms) {
          set.add(term);
        }
        termsById.set(id, set);
      }
    }
    return Object.keys(index.clips)
      .map((id) => this.get(id))
      .filter((clip): clip is CachedBroll => Boolean(clip))
      .map((clip) => ({
        id: clip.id,
        kind: clip.kind,
        file: clip.file,
        url: `/api/broll/${encodeURIComponent(clip.id)}`,
        terms: Array.from(termsById.get(clip.id) ?? []),
        orientation: orientationById.get(clip.id),
      }));
  }

  get(id: string): CachedBroll | null {
    const entry = this.readIndex().clips[id];
    if (!entry) {
      return null;
    }
    const filePath = path.join(this.dir, entry.file);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return { ...entry, path: filePath };
  }

  take(
    orientation: OrientationEnum | string,
    terms: string[],
    count: number,
    excludeIds: string[] = [],
  ): CachedBroll[] {
    const wanted = Math.max(1, count);
    const index = this.readIndex();
    const keys = [
      brollSearchKey(orientation, terms),
      ...terms.map((term) => brollSearchKey(orientation, [term])),
    ];
    const ids: string[] = [];
    for (const key of keys) {
      for (const id of index.searches[key] || []) {
        if (excludeIds.includes(id) || ids.includes(id)) {
          continue;
        }
        if (this.get(id)) {
          ids.push(id);
        }
        if (ids.length >= wanted) {
          break;
        }
      }
      if (ids.length >= wanted) {
        break;
      }
    }
    return ids
      .map((id) => this.get(id))
      .filter((clip): clip is CachedBroll => Boolean(clip));
  }

  put(
    id: string,
    kind: "video" | "image",
    sourcePath: string,
  ): CachedBroll | null {
    if (!id || !fs.existsSync(sourcePath)) {
      return null;
    }
    const ext = kind === "video" ? ".mp4" : path.extname(sourcePath) || ".jpg";
    const file = `${safeId(id)}${ext}`;
    const dest = path.join(this.dir, file);
    fs.copySync(sourcePath, dest);
    const index = this.readIndex();
    index.clips[id] = { id, kind, file };
    this.writeIndex(index);
    return { id, kind, file, path: dest };
  }

  remember(
    orientation: OrientationEnum | string,
    terms: string[],
    ids: string[],
  ): void {
    const kept = ids.filter(Boolean);
    if (kept.length === 0) {
      return;
    }
    const index = this.readIndex();
    const keys = [
      brollSearchKey(orientation, terms),
      ...terms.map((term) => brollSearchKey(orientation, [term])),
    ];
    for (const key of keys) {
      const merged = [...(index.searches[key] || [])];
      for (const id of kept) {
        if (!merged.includes(id)) {
          merged.push(id);
        }
      }
      index.searches[key] = merged.slice(-24);
    }
    this.writeIndex(index);
  }

  toVideo(clip: CachedBroll): Video {
    return {
      id: clip.id,
      url: clip.path,
      width: 1080,
      height: 1920,
      kind: clip.kind,
    };
  }

  private indexPath(): string {
    return path.join(this.dir, "index.json");
  }

  private readIndex(): IndexFile {
    const file = this.indexPath();
    if (!fs.existsSync(file)) {
      return { clips: {}, searches: {} };
    }
    try {
      const parsed = fs.readJsonSync(file) as IndexFile;
      return {
        clips: parsed.clips || {},
        searches: parsed.searches || {},
      };
    } catch {
      return { clips: {}, searches: {} };
    }
  }

  private writeIndex(index: IndexFile): void {
    fs.writeJsonSync(this.indexPath(), index, { spaces: 2 });
  }
}
