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
    options: { quick?: boolean } = {},
  ): Promise<Video> {
    const queries = searchQueriesFor(searchTerms);
    const terms = options.quick ? queries.slice(0, 2) : queries;
    const attempts: Array<() => Promise<Video>> = [];

    for (const term of terms) {
      attempts.push(() =>
        this.pexels.findVideo(
          [term],
          minDurationSeconds,
          excludeIds,
          orientation,
          4000,
          0,
          false,
        ),
      );
    }
    if (!options.quick && this.pixabay?.enabled) {
      for (const term of terms) {
        attempts.push(() =>
          this.pixabay!.findVideo(term, excludeIds, orientation),
        );
      }
    }
    if (!options.quick) {
      for (const term of terms) {
        attempts.push(() =>
          this.pexels.findPhoto(term, excludeIds, orientation),
        );
      }
      if (this.pixabay?.enabled) {
        for (const term of terms) {
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
          4000,
          0,
          true,
        ),
      );
    } else if (terms[0]) {
      attempts.push(() =>
        this.pexels.findPhoto(terms[0], excludeIds, orientation),
      );
    }

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
    const queries = searchQueriesFor(searchTerms);
    const perClipSeconds = Math.max(2.5, minDurationSeconds / wanted);
    const first = await this.findClip(
      searchTerms,
      perClipSeconds,
      excludeIds,
      orientation,
    );
    if (wanted === 1) {
      return [first];
    }

    const extras = await Promise.all(
      Array.from({ length: wanted - 1 }, (_, index) => {
        const rotated = queries.length
          ? [
              queries[(index + 1) % queries.length],
              ...queries.filter(
                (_, queryIndex) => queryIndex !== (index + 1) % queries.length,
              ),
            ]
          : searchTerms;
        return this.findClip(
          rotated.slice(0, 3),
          perClipSeconds,
          [...excludeIds, first.id],
          orientation,
          { quick: true },
        ).catch((error: unknown) => {
          logger.debug({ error, attempt: index }, "Could not find extra B-roll clip");
          return null;
        });
      }),
    );

    const clips = [first];
    for (const clip of extras) {
      if (clip && !clips.some((existing) => existing.id === clip.id)) {
        clips.push(clip);
      }
    }
    return clips;
  }
}
