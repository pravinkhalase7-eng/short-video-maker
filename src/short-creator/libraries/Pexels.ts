/* eslint-disable @remotion/deterministic-randomness */
import { getOrientationConfig } from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";
import { matchesSearchText } from "./stockRelevance";

const jokerTerms: string[] = ["nature", "globe", "space", "ocean"];
const durationBufferSeconds = 1;
const defaultTimeoutMs = 4000;
const retryTimes = 1;

export class PexelsAPI {
  constructor(private API_KEY: string) {}

  private async _findVideo(
    searchTerm: string,
    minDurationSeconds: number,
    excludeIds: string[],
    orientation: OrientationEnum,
    timeout: number,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("API key not set");
    }
    logger.debug(
      { searchTerm, minDurationSeconds, orientation },
      "Searching for video in Pexels API",
    );
    const headers = new Headers();
    headers.append("Authorization", this.API_KEY);
    const response = await fetch(
      `https://api.pexels.com/videos/search?orientation=${orientation}&size=medium&per_page=20&query=${encodeURIComponent(searchTerm)}`,
      {
        method: "GET",
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(timeout),
      },
    )
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error(
              "Invalid Pexels API key - please make sure you get a valid key from https://www.pexels.com/api and set it in the environment variable PEXELS_API_KEY",
            );
          }
          throw new Error(`Pexels API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .catch((error: unknown) => {
        logger.error(error, "Error fetching videos from Pexels API");
        throw error;
      });
    const videos = ((response.videos || []) as {
      id: string;
      url?: string;
      duration: number;
      video_files: {
        fps: number;
        quality: string;
        width: number;
        height: number;
        id: string;
        link: string;
      }[];
    }[]).filter((video) => matchesSearchText(video.url, searchTerm));

    const { width: requiredVideoWidth, height: requiredVideoHeight } =
      getOrientationConfig(orientation);

    if (!videos || videos.length === 0) {
      logger.error(
        { searchTerm, orientation },
        "No videos found in Pexels API",
      );
      throw new Error("No videos found");
    }

    const candidates = videos
      .map((video) =>
        pickPexelsVideoFile({
          video,
          excludeIds,
          minDurationSeconds,
          orientation,
          requiredVideoWidth,
          requiredVideoHeight,
        }),
      )
      .filter(Boolean);
    if (!candidates.length) {
      logger.error({ searchTerm }, "No videos found in Pexels API");
      throw new Error("No videos found");
    }

    const video = candidates[
      Math.floor(Math.random() * candidates.length)
    ] as Video;

    logger.debug(
      { searchTerm, video: video, minDurationSeconds, orientation },
      "Found video from Pexels API",
    );

    return video;
  }

  async findVideo(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
    retryCounter: number = 0,
    useJokers: boolean = true,
  ): Promise<Video> {
    const shuffledJokerTerms = useJokers
      ? [...jokerTerms].sort(() => Math.random() - 0.5)
      : [];
    const [primary, ...rest] = searchTerms.filter(Boolean);
    const orderedSearchTerms = [
      ...(primary ? [primary] : []),
      ...[...rest].sort(() => Math.random() - 0.5),
    ];

    for (const searchTerm of [...orderedSearchTerms, ...shuffledJokerTerms]) {
      try {
        return await this._findVideo(
          searchTerm,
          minDurationSeconds,
          excludeIds,
          orientation,
          timeout,
        );
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error instanceof DOMException &&
          error.name === "TimeoutError"
        ) {
          if (retryCounter < retryTimes) {
            logger.warn(
              { searchTerm, retryCounter },
              "Timeout error, retrying...",
            );
            return await this.findVideo(
              searchTerms,
              minDurationSeconds,
              excludeIds,
              orientation,
              timeout,
              retryCounter + 1,
              useJokers,
            );
          }
          logger.error(
            { searchTerm, retryCounter },
            "Timeout error, retry limit reached",
          );
          throw error;
        }

        logger.error(error, "Error finding video in Pexels API for term");
      }
    }
    logger.error(
      { searchTerms },
      "No videos found in Pexels API for the given terms",
    );
    throw new Error("No videos found in Pexels API");
  }

  async findPhoto(
    searchTerm: string,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    timeout: number = defaultTimeoutMs,
  ): Promise<Video> {
    if (!this.API_KEY) {
      throw new Error("API key not set");
    }
    logger.debug({ searchTerm, orientation }, "Searching for photo in Pexels API");
    const response = await fetch(
      `https://api.pexels.com/v1/search?orientation=${orientation}&per_page=40&query=${encodeURIComponent(searchTerm)}`,
      {
        method: "GET",
        headers: { Authorization: this.API_KEY },
        signal: AbortSignal.timeout(timeout),
      },
    );
    if (!response.ok) {
      throw new Error(`Pexels photo API error: ${response.status}`);
    }
    const data = (await response.json()) as {
      photos?: {
        id: number;
        alt?: string;
        url?: string;
        width: number;
        height: number;
        src: {
          original?: string;
          large2x?: string;
          portrait?: string;
          landscape?: string;
        };
      }[];
    };
    const photos = (data.photos || []).filter(
      (photo) =>
        !excludeIds.includes(`pexels-photo-${photo.id}`) &&
        (matchesSearchText(photo.alt, searchTerm) ||
          matchesSearchText(photo.url, searchTerm)),
    );
    if (!photos.length) {
      throw new Error("No photos found");
    }
    const photo = photos[Math.floor(Math.random() * photos.length)];
    const url =
      (orientation === OrientationEnum.portrait
        ? photo.src.portrait
        : photo.src.landscape) ||
      photo.src.large2x ||
      photo.src.original;
    if (!url) {
      throw new Error("No photos found");
    }
    const result: Video = {
      id: `pexels-photo-${photo.id}`,
      url,
      width: photo.width,
      height: photo.height,
      kind: "image",
    };
    logger.debug({ searchTerm, photo: result }, "Found photo from Pexels API");
    return result;
  }
}

export function pickPexelsVideoFile({
  video,
  excludeIds,
  minDurationSeconds,
  orientation,
  requiredVideoWidth,
  requiredVideoHeight,
}: {
  video: {
    id: string;
    duration: number;
    video_files: {
      fps: number;
      quality: string;
      width: number;
      height: number;
      link: string;
    }[];
  };
  excludeIds: string[];
  minDurationSeconds: number;
  orientation: OrientationEnum;
  requiredVideoWidth: number;
  requiredVideoHeight: number;
}): Video | undefined {
  if (excludeIds.includes(String(video.id)) || !video.video_files.length) {
    return undefined;
  }
  const fps = video.video_files[0].fps;
  const duration = fps < 25 ? video.duration * (fps / 25) : video.duration;
  if (duration < minDurationSeconds + durationBufferSeconds) {
    return undefined;
  }

  const compact = video.video_files.find(
    (file) => file.width === 720 && file.height === 1280,
  );
  if (compact) {
    return {
      id: String(video.id),
      url: compact.link,
      width: compact.width,
      height: compact.height,
      kind: "video",
    };
  }

  const exact = video.video_files.find(
    (file) =>
      file.quality === "hd" &&
      file.width === requiredVideoWidth &&
      file.height === requiredVideoHeight,
  );
  if (exact) {
    return {
      id: String(video.id),
      url: exact.link,
      width: exact.width,
      height: exact.height,
      kind: "video",
    };
  }

  const targetPixels = Math.round(
    orientation === OrientationEnum.portrait ? 720 * 1280 : 1280 * 720,
  );
  const maxPixels = Math.round(targetPixels * 1.15);
  const oriented = video.video_files
    .filter((file) =>
      orientation === OrientationEnum.portrait
        ? file.height > file.width
        : file.width > file.height,
    )
    .sort((a, b) => {
      const aPixels = a.width * a.height;
      const bPixels = b.width * b.height;
      const aOver = aPixels > maxPixels;
      const bOver = bPixels > maxPixels;
      if (aOver !== bOver) {
        return aOver ? 1 : -1;
      }
      return Math.abs(aPixels - targetPixels) - Math.abs(bPixels - targetPixels);
    })[0];
  if (!oriented) {
    return undefined;
  }
  return {
    id: String(video.id),
    url: oriented.link,
    width: oriented.width,
    height: oriented.height,
    kind: "video",
  };
}
