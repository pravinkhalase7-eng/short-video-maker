import { z } from "zod";
import {
  type Caption,
  type CaptionPage,
  type CaptionLine,
  type OrientationEnum,
  MusicVolumeEnum,
} from "../types/shorts";
import { AvailableComponentsEnum, type OrientationConfig } from "./types";

export const shortVideoSchema = z.object({
  scenes: z.array(
    z.object({
      captions: z.custom<Caption[]>(),
      audio: z.object({
        url: z.string(),
        duration: z.number(),
      }),
      video: z.string(),
      overlayText: z.string().optional(),
      exampleCard: z
        .object({
          title: z.string().optional(),
          body: z.string(),
          kind: z.enum(["code", "fact"]).optional(),
        })
        .optional(),
      kind: z.enum(["video", "image"]).optional(),
    }),
  ),
  config: z.object({
    paddingBack: z.number().optional(),
    captionPosition: z.enum(["top", "center", "bottom"]).optional(),
    captionBackgroundColor: z.string().optional(),
    durationMs: z.number(),
    musicVolume: z.nativeEnum(MusicVolumeEnum).optional(),
    hookText: z.string().optional(),
    hookDurationMs: z.number().optional(),
    endCardText: z.string().optional(),
    endCardCta: z.string().optional(),
    endCardBeats: z.array(z.string()).max(3).optional(),
    sfx: z
      .object({
        whoosh: z.string(),
        pop: z.string(),
        click: z.string(),
        sting: z.string(),
      })
      .optional(),
  }),
  music: z.object({
    file: z.string(),
    url: z.string(),
    start: z.number(),
    end: z.number(),
  }),
});

export function createCaptionPages({
  captions,
  lineMaxLength,
  lineCount,
  maxDistanceMs,
}: {
  captions: Caption[];
  lineMaxLength: number;
  lineCount: number;
  maxDistanceMs: number;
}) {
  const pages = [];
  let currentPage: CaptionPage = {
    startMs: 0,
    endMs: 0,
    lines: [],
  };
  let currentLine: CaptionLine = {
    texts: [],
  };

  captions.forEach((caption, i) => {
    // Check if we need to start a new page due to time gap
    if (i > 0 && caption.startMs - currentPage.endMs > maxDistanceMs) {
      // Add current line if not empty
      if (currentLine.texts.length > 0) {
        currentPage.lines.push(currentLine);
      }
      // Add current page if not empty
      if (currentPage.lines.length > 0) {
        pages.push(currentPage);
      }
      // Start new page
      currentPage = {
        startMs: caption.startMs,
        endMs: caption.endMs,
        lines: [],
      };
      currentLine = {
        texts: [],
      };
    }

    // Check if adding this caption exceeds the line length
    const currentLineText = currentLine.texts.map((t) => t.text).join(" ");
    if (
      currentLine.texts.length > 0 &&
      currentLineText.length + 1 + caption.text.length > lineMaxLength
    ) {
      // Line is full, add it to current page
      currentPage.lines.push(currentLine);
      currentLine = {
        texts: [],
      };

      // Check if page is full
      if (currentPage.lines.length >= lineCount) {
        // Page is full, add it to pages
        pages.push(currentPage);
        // Start new page
        currentPage = {
          startMs: caption.startMs,
          endMs: caption.endMs,
          lines: [],
        };
      }
    }

    // Add caption to current line
    currentLine.texts.push({
      text: caption.text,
      startMs: caption.startMs,
      endMs: caption.endMs,
    });

    // Update page timing
    currentPage.endMs = caption.endMs;
    if (i === 0 || currentPage.startMs === 0) {
      currentPage.startMs = caption.startMs;
    } else {
      currentPage.startMs = Math.min(currentPage.startMs, caption.startMs);
    }
  });

  // Don't forget to add the last line and page
  if (currentLine.texts.length > 0) {
    currentPage.lines.push(currentLine);
  }
  if (currentPage.lines.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

export function getOrientationConfig(orientation: OrientationEnum) {
  const config: Record<OrientationEnum, OrientationConfig> = {
    portrait: {
      width: 1080,
      height: 1920,
      component: AvailableComponentsEnum.PortraitVideo,
    },
    landscape: {
      width: 1920,
      height: 1080,
      component: AvailableComponentsEnum.LandscapeVideo,
    },
  };

  return config[orientation];
}

export function getSceneSequence({
  scenes,
  index,
  fps,
  hookFrames = 0,
}: {
  scenes: { audio: { duration: number } }[];
  index: number;
  fps: number;
  hookFrames?: number;
}): { startFrame: number; durationInFrames: number } {
  const hookExtra = Math.max(0, hookFrames);
  const spokenBefore = scenes
    .slice(0, index)
    .reduce((acc, scene) => acc + scene.audio.duration, 0);
  const startFrame = Math.round(spokenBefore * fps) + (index === 0 ? 0 : hookExtra);
  const spokenFrames = Math.max(
    1,
    Math.round(scenes[index].audio.duration * fps),
  );
  const durationInFrames =
    index === 0 ? spokenFrames + hookExtra : spokenFrames;
  return { startFrame, durationInFrames };
}

export function getOverlayTiming({
  durationMs,
  paddingBack = 0,
  hookDurationMs = 2200,
  fps,
}: {
  durationMs: number;
  paddingBack?: number;
  hookDurationMs?: number;
  fps: number;
}): { hookFrames: number; endCardFrom: number; endCardFrames: number } {
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const endCardFrames = Math.min(
    totalFrames,
    Math.max(0, Math.round((Math.max(0, paddingBack) / 1000) * fps)),
  );
  const remaining = Math.max(0, totalFrames - endCardFrames);
  const hookFrames = Math.min(
    remaining,
    Math.max(0, Math.round((Math.max(0, hookDurationMs) / 1000) * fps)),
  );
  return {
    hookFrames,
    endCardFrom: totalFrames - endCardFrames,
    endCardFrames,
  };
}

export function looksLikeCode(text: string): boolean {
  return /[{};=>]|::|->|function\s|\bclass\s|\bpublic\s|\bconst\s|\blet\s|\bvar\s|\.\w+\(|<\w+>|Stream</.test(
    text,
  );
}

export function clipCaptionPageToSafeWindow({
  pageStartMs,
  pageEndMs,
  sceneStartFrame,
  fps,
  hookFrames,
  endCardFrom,
}: {
  pageStartMs: number;
  pageEndMs: number;
  sceneStartFrame: number;
  fps: number;
  hookFrames: number;
  endCardFrom: number;
}): { from: number; durationInFrames: number } | null {
  const rawFrom = Math.round((pageStartMs / 1000) * fps);
  const rawDuration = Math.max(
    1,
    Math.round(((pageEndMs - pageStartMs) / 1000) * fps),
  );
  const globalFrom = sceneStartFrame + rawFrom;
  const globalEnd = globalFrom + rawDuration;
  const safeFrom = Math.max(globalFrom, hookFrames);
  const safeEnd = Math.min(globalEnd, endCardFrom);
  if (safeEnd - safeFrom < 3) {
    return null;
  }
  return {
    from: safeFrom - sceneStartFrame,
    durationInFrames: safeEnd - safeFrom,
  };
}

export function calculateVolume(
  level: MusicVolumeEnum = MusicVolumeEnum.high,
): [number, boolean] {
  switch (level) {
    case "muted":
      return [0, true];
    case "low":
      return [0.2, false];
    case "medium":
      return [0.45, false];
    case "high":
      return [0.7, false];
    default:
      return [0.7, false];
  }
}

export function getDuckedMusicVolume({
  frame,
  baseVolume,
  muted,
  endCardFrom,
}: {
  frame: number;
  baseVolume: number;
  muted: boolean;
  endCardFrom: number;
}): number {
  if (muted || baseVolume <= 0) {
    return 0;
  }
  const ducked = baseVolume * 0.38;
  if (frame >= endCardFrom) {
    return lerp(frame, endCardFrom, endCardFrom + 10, ducked, baseVolume);
  }
  return lerp(frame, 0, 8, 0, ducked);
}

function lerp(
  frame: number,
  from: number,
  to: number,
  startVal: number,
  endVal: number,
): number {
  if (to <= from) {
    return endVal;
  }
  if (frame <= from) {
    return startVal;
  }
  if (frame >= to) {
    return endVal;
  }
  const t = (frame - from) / (to - from);
  return startVal + (endVal - startVal) * t;
}
