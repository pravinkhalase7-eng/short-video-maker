import { Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import type { Caption } from "../../types/shorts";
import {
  clipCaptionPageToSafeWindow,
  createCaptionPages,
} from "../utils";

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
    lineMaxLength: quiet ? (isPortrait ? 14 : 20) : isPortrait ? 16 : 22,
    lineCount: 1,
    maxDistanceMs: 1000,
  });

  const position = quiet ? "bottom" : captionPosition;
  const captionStyle =
    position === "top"
      ? { top: isPortrait ? 160 : 80 }
      : position === "center"
        ? { top: "50%", transform: "translateY(-50%)" }
        : { bottom: isPortrait ? 90 : 70 };

  const fontSize = quiet
    ? isPortrait
      ? "3.1em"
      : "3.6em"
    : isPortrait
      ? "4.2em"
      : "5em";

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
              {page.lines.map((line, k) => (
                <p
                  key={`scene-${sceneIndex}-page-${j}-line-${k}`}
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
                  }}
                >
                  {line.texts.map((text, l) => {
                    const active =
                      compositionFrame >=
                        sceneStartFrame + (text.startMs / 1000) * fps &&
                      compositionFrame <=
                        sceneStartFrame + (text.endMs / 1000) * fps;
                    return (
                      <span key={`scene-${sceneIndex}-page-${j}-line-${k}-text-${l}`}>
                        <span
                          style={{
                            fontWeight: 800,
                            ...(active
                              ? {
                                  backgroundColor: captionBackgroundColor,
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
                        {l < line.texts.length - 1 ? " " : ""}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
          </Sequence>
        );
      })}
    </>
  );
};
