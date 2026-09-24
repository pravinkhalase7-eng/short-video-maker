import { OrientationEnum } from "./../types/shorts";
/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";
import https from "https";
import http from "http";

import { Kokoro } from "./libraries/Kokoro";
import { Remotion } from "./libraries/Remotion";
import { Whisper } from "./libraries/Whisper";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { PixabayAPI } from "./libraries/Pixabay";
import { StockMedia } from "./libraries/StockMedia";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import {
  stretchSceneDurations,
  clipCountForDuration,
  captionsFromSpeech,
  usesHardcodedWorksheet,
} from "../components/utils";
import { buildInstagramPost, type VideoPostMeta } from "./libraries/instagramPost";
import {
  llmQuizExplanation,
  quizFactsFromScenes,
} from "./libraries/quizExplanation";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
  MusicForVideo,
} from "../types/shorts";

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
    prompt?: string;
    explanation?: string;
  }[] = [];
  private stockMedia: StockMedia;
  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {
    this.stockMedia = new StockMedia(
      pexelsApi,
      new PixabayAPI(config.pixabayApiKey),
    );
  }

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public async addToQueue(
    sceneInput: SceneInput[],
    config: RenderConfig,
    prompt?: string,
    explanation?: string,
  ): Promise<string> {
    // todo add mutex lock
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
      prompt,
      explanation,
    });
    let caption = explanation?.trim();
    if (!caption && config.format === "quiz") {
      caption = await this.requireGeminiExplanation(
        sceneInput,
        config,
        prompt,
      );
    }
    this.saveVideoMeta(id, sceneInput, config, prompt, caption);
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { sceneInput, config, id } = this.queue[0];
    logger.debug(
      { sceneInput, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");
    } catch (error: unknown) {
      logger.error(error, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    logger.debug(
      {
        inputScenes,
        config,
      },
      "Creating short video",
    );
    const scenes: Scene[] = [];
    let totalDuration = 0;
    const excludeVideoIds = [];
    const tempFiles = [];

    const orientation: OrientationEnum =
      config.orientation || OrientationEnum.portrait;

    const prepared: {
      input: SceneInput;
      audioLength: number;
      captions: Scene["captions"];
      tempId: string;
      tempMp3Path: string;
    }[] = [];

    let index = 0;
    for (const scene of inputScenes) {
      const audio = await this.kokoro.generate(
        scene.text,
        config.voice ?? "af_heart",
      );
      const spokenLength = audio.audioLength;
      let audioLength = spokenLength;
      const { audio: audioStream } = audio;
      if (scene.holdMs) {
        audioLength += scene.holdMs / 1000;
      }
      if (index + 1 === inputScenes.length && config.paddingBack) {
        audioLength += config.paddingBack / 1000;
      }

      const tempId = cuid();
      const tempAudioFileName = `${tempId}.wav`;
      const tempAudioPath = path.join(this.config.tempDirPath, tempAudioFileName);
      tempFiles.push(tempAudioPath);

      let captions: Scene["captions"];
      if (this.config.whisperCaptions) {
        const tempWavPath = path.join(this.config.tempDirPath, `${tempId}-whisper.wav`);
        tempFiles.push(tempWavPath);
        await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
        captions = await this.whisper.CreateCaption(tempWavPath);
      } else {
        captions = captionsFromSpeech(
          scene.text,
          spokenLength,
          speechBoundsFromWav(audioStream),
        );
      }
      await fs.writeFile(tempAudioPath, Buffer.from(audioStream));

      prepared.push({
        input: scene,
        audioLength,
        captions,
        tempId,
        tempMp3Path: tempAudioPath,
      });
      index++;
    }

    const hookMs = config.hookText?.trim()
      ? config.hookDurationMs ?? 2200
      : 0;
    if (config.targetDurationSec && config.format !== "quiz") {
      const stretched = stretchSceneDurations(
        prepared.map((item) => item.audioLength),
        config.targetDurationSec,
        hookMs / 1000,
      );
      prepared.forEach((item, sceneIndex) => {
        item.audioLength = stretched[sceneIndex];
      });
    }

    for (const item of prepared) {
      const useWorksheet = usesHardcodedWorksheet(config, inputScenes);
      let clips: { url: string; kind?: "video" | "image" }[];
      if (useWorksheet) {
        logger.debug({ videoId }, "Using hardcoded quiz worksheet, skipping stock download");
        clips = [
          {
            url: this.remotionAssetUrl("/static/worksheets/desk.svg"),
            kind: "image",
          },
        ];
      } else {
        const wanted = clipCountForDuration(item.audioLength);
        const found = await this.stockMedia.findClips(
          item.input.searchTerms,
          Math.max(2.5, item.audioLength / wanted),
          excludeVideoIds,
          orientation,
          wanted,
        );
        const downloaded = await Promise.all(
          found.map(async (clip, clipIndex) => {
            const isImage = clip.kind === "image";
            const tempMediaFileName = `${item.tempId}-c${clipIndex}.${isImage ? "jpg" : "mp4"}`;
            const tempMediaPath = path.join(
              this.config.tempDirPath,
              tempMediaFileName,
            );
            tempFiles.push(tempMediaPath);
            logger.debug(
              `Downloading ${clip.kind || "video"} from ${clip.url} to ${tempMediaPath}`,
            );
            await downloadHttpFile(clip.url, tempMediaPath);
            return {
              url: this.remotionAssetUrl(`/api/tmp/${tempMediaFileName}`),
              kind: clip.kind,
            };
          }),
        );
        for (const clip of found) {
          excludeVideoIds.push(clip.id);
        }
        clips = downloaded;
      }

      scenes.push({
        captions: item.captions,
        video: clips[0].url,
        clips,
        audio: {
          url: this.remotionAssetUrl(`/api/tmp/${item.tempId}.wav`),
          duration: item.audioLength,
        },
        overlayText: item.input.overlayText?.trim() || undefined,
        exampleCard: item.input.exampleCard,
        kind: clips[0].kind,
        holdMs: item.input.holdMs,
      });

      totalDuration += item.audioLength;
    }

    const selectedMusic = this.findMusic(totalDuration, config.music);
    logger.debug({ selectedMusic }, "Selected music for the video");

    await this.remotion.render(
      {
        music: selectedMusic,
        scenes,
        config: {
          durationMs: totalDuration * 1000 + hookMs,
          paddingBack: config.paddingBack,
          captionBackgroundColor: config.captionBackgroundColor,
          captionPosition: config.captionPosition,
          musicVolume: config.musicVolume,
          hookText: config.hookText,
          hookDurationMs: config.hookDurationMs,
          endCardText: config.endCardText,
          endCardCta: config.endCardCta,
          format: config.format,
          endCardBeats: (() => {
            const beats = (config.endCardBeats || [])
              .map((beat) => beat.trim())
              .filter(Boolean)
              .slice(0, 3);
            if (beats.length > 0) {
              return beats;
            }
            return scenes
              .map(
                (scene) =>
                  scene.exampleCard?.title?.trim() ||
                  scene.overlayText?.trim() ||
                  "",
              )
              .filter(Boolean)
              .slice(0, 3);
          })(),
          sfx: {
            whoosh: this.remotionAssetUrl("/static/sfx/whoosh.mp3"),
            pop: this.remotionAssetUrl("/static/sfx/pop.mp3"),
            click: this.remotionAssetUrl("/static/sfx/click.mp3"),
            sting: this.remotionAssetUrl("/static/sfx/sting.mp3"),
            beep: this.remotionAssetUrl("/static/sfx/beep.mp3"),
            clap: this.remotionAssetUrl("/static/sfx/clap.mp3"),
            correct: this.remotionAssetUrl("/static/sfx/correct.mp3"),
            tick: this.remotionAssetUrl("/static/sfx/tick.mp3"),
            count: this.remotionAssetUrl("/static/sfx/count.mp3"),
          },
        },
      },
      videoId,
      orientation,
    );

    for (const file of tempFiles) {
      fs.removeSync(file);
    }

    return videoId;
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.mp4`);
  }

  public getVideoMetaPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.json`);
  }

  public getVideoMeta(videoId: string): VideoPostMeta | null {
    const metaPath = this.getVideoMetaPath(videoId);
    if (!fs.existsSync(metaPath)) {
      return null;
    }
    try {
      return fs.readJsonSync(metaPath) as VideoPostMeta;
    } catch (error: unknown) {
      logger.error({ error, videoId }, "Failed to read video meta");
      return null;
    }
  }

  private saveVideoMeta(
    videoId: string,
    scenes: SceneInput[],
    config: RenderConfig,
    prompt?: string,
    explanation?: string,
  ): VideoPostMeta {
    const meta = buildInstagramPost({
      id: videoId,
      prompt,
      scenes,
      config,
      explanation,
    });
    fs.writeJsonSync(this.getVideoMetaPath(videoId), meta, { spaces: 2 });
    return meta;
  }

  private async requireGeminiExplanation(
    scenes: SceneInput[],
    config: RenderConfig,
    prompt?: string,
  ): Promise<string> {
    const facts = quizFactsFromScenes({ prompt, scenes, config });
    if (!facts) {
      throw new Error("Could not read the quiz worksheet for Gemini explanation");
    }
    return llmQuizExplanation(this.config, { ...facts, prompt });
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    fs.removeSync(this.getVideoMetaPath(videoId));
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): MusicForVideo {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });
    const selected = musicFiles[Math.floor(Math.random() * musicFiles.length)];
    return {
      ...selected,
      url: this.remotionAssetUrl(
        `/api/music/${encodeURIComponent(selected.file)}`,
      ),
    };
  }

  private remotionAssetUrl(route: string): string {
    return `http://127.0.0.1:${this.config.port}${route}`;
  }

  public ListAvailableMusicTags(): MusicTag[] {
    const tags = new Set<MusicTag>();
    this.musicManager.musicList().forEach((music) => {
      tags.add(music.mood as MusicTag);
    });
    return Array.from(tags.values());
  }

  public listAllVideos(): {
    id: string;
    status: VideoStatus;
    title?: string;
    prompt?: string;
  }[] {
    const videos: {
      id: string;
      status: VideoStatus;
      title?: string;
      prompt?: string;
    }[] = [];

    // Check if videos directory exists
    if (!fs.existsSync(this.config.videosDirPath)) {
      return videos;
    }

    // Read all files in the videos directory
    const files = fs.readdirSync(this.config.videosDirPath);

    // Filter for MP4 files and extract video IDs
    for (const file of files) {
      if (file.endsWith(".mp4")) {
        const videoId = file.replace(".mp4", "");

        let status: VideoStatus = "ready";
        const inQueue = this.queue.find((item) => item.id === videoId);
        if (inQueue) {
          status = "processing";
        }

        videos.push(this.withListMeta(videoId, status));
      }
    }

    // Add videos that are in the queue but not yet rendered
    for (const queueItem of this.queue) {
      const existingVideo = videos.find((v) => v.id === queueItem.id);
      if (!existingVideo) {
        videos.push(this.withListMeta(queueItem.id, "processing"));
      }
    }

    return videos;
  }

  private withListMeta(
    videoId: string,
    status: VideoStatus,
  ): { id: string; status: VideoStatus; title?: string; prompt?: string } {
    const meta = this.getVideoMeta(videoId);
    return {
      id: videoId,
      status,
      title: meta?.title,
      prompt: meta?.prompt,
    };
  }

  public ListAvailableVoices(): string[] {
    return this.kokoro.listAvailableVoices();
  }
}

function speechBoundsFromWav(
  wav: ArrayBuffer,
): { startSec: number; endSec: number } | null {
  const buf = Buffer.from(wav);
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
    return null;
  }
  const channels = Math.max(1, buf.readUInt16LE(22));
  const sampleRate = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  if (bits !== 16 || sampleRate < 8000) {
    return null;
  }
  let offset = 12;
  let dataStart = 44;
  let dataLen = buf.length - 44;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") {
      dataStart = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size;
  }
  const bytesPerSample = 2 * channels;
  const samples = Math.floor(Math.max(0, dataLen) / bytesPerSample);
  if (samples < 32) {
    return null;
  }
  const threshold = 700;
  let first = -1;
  let last = -1;
  for (let i = 0; i < samples; i++) {
    const pos = dataStart + i * bytesPerSample;
    if (pos + 2 > buf.length) {
      break;
    }
    let peak = 0;
    for (let channel = 0; channel < channels; channel++) {
      peak = Math.max(peak, Math.abs(buf.readInt16LE(pos + channel * 2)));
    }
    if (peak >= threshold) {
      if (first < 0) {
        first = i;
      }
      last = i;
    }
  }
  if (first < 0 || last <= first) {
    return null;
  }
  const duration = samples / sampleRate;
  return {
    startSec: Math.max(0, first / sampleRate - 0.04),
    endSec: Math.min(duration, last / sampleRate + 0.1),
  };
}

function downloadHttpFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const request = client.get(url, (response: http.IncomingMessage) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        const nextUrl = new URL(location, url).toString();
        downloadHttpFile(nextUrl, dest).then(resolve, reject);
        return;
      }
      if (status !== 200) {
        reject(new Error(`Failed to download media: ${status}`));
        return;
      }
      const fileStream = fs.createWriteStream(dest);
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
      fileStream.on("error", reject);
    });
    request.on("error", (err: Error) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}
