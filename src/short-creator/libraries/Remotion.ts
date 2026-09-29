import z from "zod";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { ensureBrowser } from "@remotion/renderer";

import { Config } from "../../config";
import {
  INSTAGRAM_REEL,
  getOrientationConfig,
  isQuizAnswerCard,
  isQuizQuestionCard,
  shortVideoSchema,
} from "../../components/utils";
import { logger } from "../../logger";
import { OrientationEnum } from "../../types/shorts";

export class Remotion {
  constructor(
    private bundled: string,
    private config: Config,
  ) {}

  static async init(config: Config): Promise<Remotion> {
    await ensureBrowser();

    const bundled = await bundle({
      entryPoint: path.join(
        config.packageDirPath,
        config.devMode ? "src" : "dist",
        "components",
        "root",
        `index.${config.devMode ? "ts" : "js"}`,
      ),
    });

    return new Remotion(bundled, config);
  }

  async render(
    data: z.infer<typeof shortVideoSchema>,
    id: string,
    orientation: OrientationEnum,
    onProgress?: (progress: number) => void,
  ) {
    const { component } = getOrientationConfig(orientation);
    const isQuiz = data.config.format === "quiz";
    const concurrency = isQuiz
      ? this.config.runningInDocker
        ? 2
        : Math.max(
            this.config.concurrency ?? 4,
            Math.min(6, (os.cpus().length || 4) - 1),
          )
      : this.config.concurrency ?? 1;

    const posters =
      isQuiz && orientation === OrientationEnum.portrait
        ? await this.makeQuizRenderStills(data, id)
        : {};
    const inputProps = {
      ...data,
      config: {
        ...data.config,
        ...posters,
      },
    };

    const composition = await selectComposition({
      serveUrl: this.bundled,
      id: component,
      inputProps,
    });

    logger.info(
      {
        component,
        videoID: id,
        concurrency,
        isQuiz,
        fps: composition.fps,
        frames: composition.durationInFrames,
      },
      "Rendering video with Remotion",
    );

    const outputLocation = path.join(this.config.videosDirPath, `${id}.mp4`);
    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let lastLogged = -1;
        await renderMedia({
          codec: "h264",
          composition,
          serveUrl: this.bundled,
          outputLocation,
          inputProps,
          onProgress: ({ progress }) => {
            onProgress?.(progress);
            const pct = Math.floor(progress * 100);
            if (pct >= lastLogged + 10) {
              lastLogged = pct;
              logger.info(
                { videoID: id, progress: pct },
                "Remotion render progress",
              );
            }
          },
          concurrency,
          ...(isQuiz
            ? {}
            : {
                offthreadVideoCacheSizeInBytes:
                  this.config.videoCacheSizeInBytes,
              }),
          timeoutInMilliseconds: 180000,
          x264Preset: isQuiz || this.config.runningInDocker ? "ultrafast" : "veryfast",
          jpegQuality: isQuiz ? 50 : 60,
        });
        lastError = undefined;
        break;
      } catch (error: unknown) {
        lastError = error;
        logger.warn(
          { attempt, maxAttempts, videoID: id, error },
          "Remotion render failed",
        );
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        }
      }
    }

    await Promise.all(
      [posters.quizHoldPoster, posters.quizAnswerPoster]
        .filter(Boolean)
        .map((url) => {
          const file = String(url).split("/api/tmp/")[1];
          return file
            ? fs.remove(path.join(this.config.tempDirPath, file)).catch(() => undefined)
            : Promise.resolve();
        }),
    );

    if (lastError) {
      throw lastError;
    }

    logger.debug(
      {
        outputLocation,
        component,
        videoID: id,
      },
      "Video rendered with Remotion",
    );
  }

  async renderStillPoster(
    data: { title?: string; body: string; answer?: string },
    outputLocation: string,
    imageFormat: "png" | "jpeg" = "png",
  ) {
    const composition = await selectComposition({
      serveUrl: this.bundled,
      id: "QuizPoster",
      inputProps: data,
    });

    logger.debug(
      {
        outputLocation,
        width: composition.width,
        height: composition.height,
      },
      "Rendering quiz poster still",
    );

    if (
      composition.width !== INSTAGRAM_REEL.width ||
      composition.height !== INSTAGRAM_REEL.height
    ) {
      throw new Error(
        `Quiz poster must be ${INSTAGRAM_REEL.width}×${INSTAGRAM_REEL.height} (9:16)`,
      );
    }

    await renderStill({
      composition,
      serveUrl: this.bundled,
      output: outputLocation,
      inputProps: data,
      frame: 0,
      imageFormat,
      ...(imageFormat === "jpeg" ? { jpegQuality: 72 } : {}),
      scale: 1,
      timeoutInMilliseconds: 120000,
    });
  }

  private async makeQuizRenderStills(
    data: z.infer<typeof shortVideoSchema>,
    id: string,
  ): Promise<{ quizHoldPoster?: string; quizAnswerPoster?: string }> {
    const question = data.scenes.find((scene) =>
      isQuizQuestionCard(scene.exampleCard, scene.overlayText),
    )?.exampleCard;
    const answerScene = data.scenes.find((scene) =>
      isQuizAnswerCard(scene.exampleCard, scene.overlayText),
    );
    if (!question?.body?.trim()) {
      return {};
    }
    await fs.ensureDir(this.config.tempDirPath);
    const holdFile = `${id}-hold.jpg`;
    const answerFile = `${id}-answer.jpg`;
    const holdPath = path.join(this.config.tempDirPath, holdFile);
    const answerPath = path.join(this.config.tempDirPath, answerFile);
    const asset = (file: string) =>
      `http://127.0.0.1:${this.config.port}/api/tmp/${file}`;
    try {
      const jobs: Promise<void>[] = [
        this.renderStillPoster(
          { title: question.title, body: question.body },
          holdPath,
          "jpeg",
        ),
      ];
      if (answerScene?.exampleCard?.body?.trim()) {
        jobs.push(
          this.renderStillPoster(
            {
              title: question.title,
              body: question.body,
              answer:
                answerScene.overlayText?.trim() ||
                answerScene.exampleCard.title,
            },
            answerPath,
            "jpeg",
          ),
        );
      }
      await Promise.all(jobs);
      return {
        quizHoldPoster: asset(holdFile),
        quizAnswerPoster: fs.existsSync(answerPath) ? asset(answerFile) : undefined,
      };
    } catch (error: unknown) {
      logger.warn({ error, videoID: id }, "Quiz hold stills failed; rendering live frames");
      return {};
    }
  }

  async testRender(outputLocation: string) {
    const composition = await selectComposition({
      serveUrl: this.bundled,
      id: "TestVideo",
    });

    await renderMedia({
      codec: "h264",
      composition,
      serveUrl: this.bundled,
      outputLocation,
      onProgress: ({ progress }) => {
        logger.debug(
          `Rendering test video: ${Math.floor(progress * 100)}% complete`,
        );
      },
      // preventing memory issues with docker
      concurrency: this.config.concurrency,
      offthreadVideoCacheSizeInBytes: this.config.videoCacheSizeInBytes,
    });
  }
}
