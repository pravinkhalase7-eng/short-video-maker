/* eslint-disable @remotion/deterministic-randomness */
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";
import { matchesSearchText } from "./stockRelevance";

const defaultTimeoutMs = 5000;

export class PixabayAPI {
  constructor(private API_KEY?: string) {}

  get enabled(): boolean {
    return Boolean(this.API_KEY);
  }

  async findVideo(
    searchTerm: string,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("Pixabay API key not set");
    }
    logger.debug(
      { searchTerm, orientation },
      "Searching for video in Pixabay API",
    );
    const url = new URL("https://pixabay.com/api/videos/");
    url.searchParams.set("key", this.API_KEY);
    url.searchParams.set("q", searchTerm);
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("per_page", "40");
    url.searchParams.set("video_type", "film");

    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) {
      throw new Error(`Pixabay video API error: ${response.status}`);
    }
    const data = (await response.json()) as {
      hits?: {
        id: number;
        tags?: string;
        pageURL?: string;
        videos?: Record<
          string,
          { url?: string; width?: number; height?: number }
        >;
      }[];
    };

    const matches = (data.hits || [])
      .filter(
        (hit) =>
          matchesSearchText(hit.tags, searchTerm) ||
          matchesSearchText(hit.pageURL, searchTerm),
      )
      .map((hit) => {
        const file =
          pickSizedFile(hit.videos, orientation) ||
          hit.videos?.medium ||
          hit.videos?.small;
        if (!file?.url) {
          return undefined;
        }
        const id = `pixabay-video-${hit.id}`;
        if (excludeIds.includes(id)) {
          return undefined;
        }
        if (!matchesOrientation(file.width || 0, file.height || 0, orientation)) {
          return undefined;
        }
        return {
          id,
          url: file.url,
          width: file.width || 0,
          height: file.height || 0,
          kind: "video" as const,
        };
      })
      .filter(Boolean);

    if (!matches.length) {
      throw new Error("No Pixabay videos found");
    }
    const video = matches[Math.floor(Math.random() * matches.length)] as Video;
    logger.debug({ searchTerm, video }, "Found video from Pixabay API");
    return video;
  }

  async findPhoto(
    searchTerm: string,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("Pixabay API key not set");
    }
    logger.debug(
      { searchTerm, orientation },
      "Searching for photo in Pixabay API",
    );
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", this.API_KEY);
    url.searchParams.set("q", searchTerm);
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("per_page", "40");
    url.searchParams.set(
      "orientation",
      orientation === OrientationEnum.portrait ? "vertical" : "horizontal",
    );

    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) {
      throw new Error(`Pixabay photo API error: ${response.status}`);
    }
    const data = (await response.json()) as {
      hits?: {
        id: number;
        tags?: string;
        pageURL?: string;
        largeImageURL?: string;
        webformatURL?: string;
        imageWidth?: number;
        imageHeight?: number;
      }[];
    };
    const photos = (data.hits || [])
      .filter(
        (hit) =>
          matchesSearchText(hit.tags, searchTerm) ||
          matchesSearchText(hit.pageURL, searchTerm),
      )
      .map((hit) => {
        const imageUrl = hit.largeImageURL || hit.webformatURL;
        const id = `pixabay-photo-${hit.id}`;
        if (!imageUrl || excludeIds.includes(id)) {
          return undefined;
        }
        return {
          id,
          url: imageUrl,
          width: hit.imageWidth || 0,
          height: hit.imageHeight || 0,
          kind: "image" as const,
        };
      })
      .filter(Boolean);
    if (!photos.length) {
      throw new Error("No Pixabay photos found");
    }
    const photo = photos[Math.floor(Math.random() * photos.length)] as Video;
    logger.debug({ searchTerm, photo }, "Found photo from Pixabay API");
    return photo;
  }
}

function matchesOrientation(
  width: number,
  height: number,
  orientation: OrientationEnum,
): boolean {
  if (!width || !height) {
    return true;
  }
  return orientation === OrientationEnum.portrait ? height >= width : width >= height;
}

function pickSizedFile(
  videos: Record<string, { url?: string; width?: number; height?: number }> | undefined,
  orientation: OrientationEnum,
) {
  if (!videos) {
    return undefined;
  }
  const order = ["medium", "large", "small", "tiny"];
  return order
    .map((key) => videos[key])
    .find(
      (file) =>
        file?.url &&
        matchesOrientation(file.width || 0, file.height || 0, orientation),
    );
}
