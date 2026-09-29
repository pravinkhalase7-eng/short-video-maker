import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import type { CSSProperties } from "react";
import type { Caption } from "../../types/shorts";
import {
  clipCaptionPageToSafeWindow,
  createCaptionPages,
  isPunchCaptionWord,
} from "../utils";
import { VN_EASE, vnEnter, vnTransform } from "./VnMotion";

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
        : { bottom: isPortrait ? (quiet ? 96 : 160) : 90 };

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
              sceneStartFrame={sceneStartFrame}
              compositionFrame={compositionFrame}
              fps={fps}
              captionStyle={captionStyle}
              fontSize={fontSize}
              captionBackgroundColor={captionBackgroundColor}
              quiet={quiet}
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
  sceneStartFrame: number;
  compositionFrame: number;
  fps: number;
  captionStyle: CSSProperties;
  fontSize: string;
  captionBackgroundColor: string;
  quiet: boolean;
}> = ({
  texts,
  sceneIndex,
  pageIndex,
  sceneStartFrame,
  compositionFrame,
  fps,
  captionStyle,
  fontSize,
  captionBackgroundColor,
  quiet,
}) => {
  const frame = useCurrentFrame();
  const enter = vnEnter(frame, 0, {
    duration: 8,
    fromY: 36,
    fromScale: 0.86,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: "100%",
        paddingLeft: 36,
        paddingRight: 36,
        ...captionStyle,
      }}
    >
      <p
        style={{
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
          transform: vnTransform(enter),
        }}
      >
        {texts.map((text, l) => {
          const wordStart = sceneStartFrame + (text.startMs / 1000) * fps;
          const wordEnd = sceneStartFrame + (text.endMs / 1000) * fps;
          const active =
            compositionFrame >= wordStart && compositionFrame <= wordEnd;
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
          return (
            <span key={`scene-${sceneIndex}-page-${pageIndex}-text-${l}`}>
              <span
                style={{
                  display: "inline-block",
                  fontWeight: 800,
                  transform: `scale(${wordScale})`,
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
  );
};
