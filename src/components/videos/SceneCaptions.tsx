import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import type { CSSProperties } from "react";
import type { Caption } from "../../types/shorts";
import {
  clipCaptionPageToSafeWindow,
  createCaptionPages,
  isPunchCaptionWord,
} from "../utils";
import { VN_EASE, vnEnter, vnExit, vnTransform } from "./VnMotion";

const { fontFamily } = loadFont();

export const SceneCaptions: React.FC<{
  captions: Caption[];
  sceneIndex: number;
  sceneStartFrame: number;
  compositionFrame: number;
  fps: number;
  hookFrames: number;
  endCardFrom: number;
  variant: "portrait" | "landscape";
  captionPosition: "top" | "center" | "bottom";
  captionBackgroundColor: string;
  quiet: boolean;
}> = ({
  captions,
  sceneIndex,
  sceneStartFrame,
  compositionFrame,
  fps,
  hookFrames,
  endCardFrom,
  variant,
  captionPosition,
  captionBackgroundColor,
  quiet,
}) => {
  const isPortrait = variant === "portrait";
  const pages = createCaptionPages({
    captions,
    lineMaxLength: quiet ? (isPortrait ? 8 : 12) : isPortrait ? 10 : 14,
    lineCount: 1,
    maxDistanceMs: 420,
  });

  const position = quiet ? "bottom" : captionPosition;
  const captionStyle =
    position === "top"
      ? { top: isPortrait ? 160 : 80 }
      : position === "center"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: isPortrait ? (quiet ? 260 : 160) : 90 };

  const fontSize = quiet
    ? isPortrait
      ? "3.4em"
      : "3.8em"
    : isPortrait
      ? "4.8em"
      : "5.4em";

  return (
    <>
      {pages.map((page, j) => {
        const windowed = clipCaptionPageToSafeWindow({
          pageStartMs: page.startMs,
          pageEndMs: page.endMs,
          sceneStartFrame,
          fps,
          hookFrames,
          endCardFrom,
        });
        if (!windowed) {
          return null;
        }

        return (
          <Sequence
            key={`scene-${sceneIndex}-page-${j}`}
            from={windowed.from}
            durationInFrames={windowed.durationInFrames}
          >
            <KineticCaptionLine
              texts={page.lines[0]?.texts || []}
              sceneIndex={sceneIndex}
              pageIndex={j}
              durationInFrames={windowed.durationInFrames}
              sceneStartFrame={sceneStartFrame}
              compositionFrame={compositionFrame}
              fps={fps}
              captionStyle={captionStyle}
              fontSize={fontSize}
              captionBackgroundColor={captionBackgroundColor}
              quiet={quiet}
              isPortrait={isPortrait}
            />
          </Sequence>
        );
      })}
    </>
  );
};

const KineticCaptionLine: React.FC<{
  texts: Caption[];
  sceneIndex: number;
  pageIndex: number;
  durationInFrames: number;
  sceneStartFrame: number;
  compositionFrame: number;
  fps: number;
  captionStyle: CSSProperties;
  fontSize: string;
  captionBackgroundColor: string;
  quiet: boolean;
  isPortrait: boolean;
}> = ({
  texts,
  sceneIndex,
  pageIndex,
  durationInFrames,
  sceneStartFrame,
  compositionFrame,
  fps,
  captionStyle,
  fontSize,
  captionBackgroundColor,
  quiet,
  isPortrait,
}) => {
  const frame = useCurrentFrame();
  const dir = (sceneIndex + pageIndex) % 2 === 0 ? 1 : -1;
  const enter = vnEnter(frame, 0, {
    duration: 11,
    fromX: dir * (quiet ? 120 : 220),
    fromY: quiet ? 18 : 8,
    fromScale: 0.88,
  });
  const exit = vnExit(frame, durationInFrames, 7);
  const barGrow = interpolate(frame, [0, 9], [0.08, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: VN_EASE,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: "100%",
        paddingLeft: isPortrait ? 56 : 36,
        paddingRight: isPortrait ? 56 : 36,
        ...captionStyle,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          opacity: enter.opacity * (1 - exit),
          transform: vnTransform(enter, dir * -160 * exit),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "4%",
            right: "4%",
            top: quiet ? "18%" : "12%",
            bottom: quiet ? "10%" : "6%",
            borderRadius: quiet ? 14 : 18,
            backgroundColor: "rgba(8, 10, 24, 0.72)",
            transform: `scaleX(${barGrow})`,
            transformOrigin: dir > 0 ? "left center" : "right center",
            boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
          }}
        />
        <p
          style={{
            position: "relative",
            fontSize,
            fontFamily,
            fontWeight: 800,
            color: "white",
            WebkitTextStroke: "2px black",
            WebkitTextFillColor: "white",
            textShadow: "0px 0px 10px black",
            textAlign: "center",
            width: "100%",
            textTransform: "uppercase",
            margin: 0,
            padding: quiet ? "10px 16px" : "14px 18px",
          }}
        >
          {texts.map((text, l) => {
            const wordStart = sceneStartFrame + (text.startMs / 1000) * fps;
            const wordEnd = sceneStartFrame + (text.endMs / 1000) * fps;
            const spoken = compositionFrame >= wordStart;
            const active =
              spoken && compositionFrame <= wordEnd;
            const punch = isPunchCaptionWord(text.text);
            const local = compositionFrame - wordStart;
            const wordScale = active
              ? interpolate(
                  local,
                  [0, 4, 9],
                  punch ? [0.7, 1.32, 1.08] : [0.88, 1.14, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: VN_EASE,
                  },
                )
              : 1;
            const wordX = interpolate(
              local,
              [0, 6],
              [spoken ? dir * (punch ? -56 : 36) : dir * 28, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: VN_EASE,
              },
            );
            return (
              <span key={`scene-${sceneIndex}-page-${pageIndex}-text-${l}`}>
                <span
                  style={{
                    display: "inline-block",
                    fontWeight: 800,
                    opacity: spoken ? 1 : 0.32,
                    transform: `translateX(${wordX}px) scale(${wordScale})`,
                    ...(active
                      ? {
                          backgroundColor: punch
                            ? "#E53935"
                            : captionBackgroundColor,
                          padding: quiet ? "4px 8px" : "8px 10px",
                          marginLeft: quiet ? "-8px" : "-10px",
                          marginRight: quiet ? "-8px" : "-10px",
                          borderRadius: quiet ? 8 : 10,
                        }
                      : {}),
                  }}
                >
                  {text.text}
                </span>
                {l < texts.length - 1 ? " " : ""}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
};
