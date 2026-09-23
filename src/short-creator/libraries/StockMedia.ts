import { logger } from "../../logger";
import { OrientationEnum, type Video } from "../../types/shorts";
import { PexelsAPI } from "./Pexels";
import { PixabayAPI } from "./Pixabay";
import { searchQueriesFor } from "./stockRelevance";

export class StockMedia {
  constructor(
    private pexels: PexelsAPI,
    private pixabay?: PixabayAPI,
  ) {}

  async findClip(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
  ): Promise<Video> {
    const queries = searchQueriesFor(searchTerms);
    const attempts: Array<() => Promise<Video>> = [];

    for (const term of queries) {
      attempts.push(() =>
        this.pexels.findVideo(
          [term],
          minDurationSeconds,
          excludeIds,
          orientation,
          5000,
          0,
          false,
        ),
      );
    }
    if (this.pixabay?.enabled) {
      for (const term of queries) {
        attempts.push(() =>
          this.pixabay!.findVideo(term, excludeIds, orientation),
        );
      }
    }
    for (const term of queries) {
      attempts.push(() => this.pexels.findPhoto(term, excludeIds, orientation));
    }
    if (this.pixabay?.enabled) {
      for (const term of queries) {
        attempts.push(() =>
          this.pixabay!.findPhoto(term, excludeIds, orientation),
        );
      }
    }
    attempts.push(() =>
      this.pexels.findVideo(
        queries,
        minDurationSeconds,
        excludeIds,
        orientation,
        5000,
        0,
        true,
      ),
    );

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        const clip = await attempt();
        logger.debug(
          { id: clip.id, kind: clip.kind, url: clip.url },
          "Selected stock clip",
        );
        return clip;
      } catch (error: unknown) {
        lastError = error;
      }
    }

    logger.error({ searchTerms, lastError }, "No stock clip found");
    throw lastError instanceof Error
      ? lastError
      : new Error("No stock clip found");
  }

  async findClips(
    searchTerms: string[],
    minDurationSeconds: number,
    excludeIds: string[] = [],
    orientation: OrientationEnum = OrientationEnum.portrait,
    count = 3,
  ): Promise<Video[]> {
    const wanted = Math.max(1, Math.min(3, count));
    const clips: Video[] = [];
    const excluded = [...excludeIds];
    const queries = searchQueriesFor(searchTerms);
    const perClipSeconds = Math.max(2.5, minDurationSeconds / wanted);

    for (let i = 0; i < wanted; i += 1) {
      const rotated = queries.length
        ? [queries[i % queries.length], ...queries.filter((_, index) => index !== i % queries.length)]
        : searchTerms;
      try {
        const clip = await this.findClip(
          rotated.slice(0, 3),
          perClipSeconds,
          excluded,
          orientation,
        );
        clips.push(clip);
        excluded.push(clip.id);
      } catch (error: unknown) {
        logger.debug({ error, attempt: i }, "Could not find extra B-roll clip");
        break;
      }
    }

    if (clips.length === 0) {
      throw new Error("No stock clip found");
    }
    return clips;
  }
}
