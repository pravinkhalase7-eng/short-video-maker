import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/BarlowCondensed";
import { z } from "zod";

import { getOverlayTiming, shortVideoSchema } from "../utils";

const { fontFamily } = loadFont();

type OverlayVariant = "portrait" | "landscape";

export const StoryOverlaySequences: React.FC<{
  config: z.infer<typeof shortVideoSchema>["config"];
  variant: OverlayVariant;
}> = ({ config, variant }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const { hookFrames, endCardFrom, endCardFrames } = getOverlayTiming({
    durationMs: (durationInFrames / fps) * 1000,
    paddingBack: config.paddingBack,
    hookDurationMs: config.hookDurationMs ?? 2200,
    fps,
  });

  const hookText = config.hookText?.trim();
  const endCardText = config.endCardText?.trim();
  const endCardCta = config.endCardCta?.trim();
  const endCardBeats = (config.endCardBeats || [])
    .map((beat) => beat.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <>
      {hookText && hookFrames > 0 && (
        <Sequence from={0} durationInFrames={hookFrames} name="Hook">
          <HookOverlay text={hookText} variant={variant} holdFrames={hookFrames} />
        </Sequence>
      )}
      {endCardText && endCardFrames > 0 && (
        <Sequence
          from={endCardFrom}
          durationInFrames={endCardFrames}
          name="EndCard"
        >
          <EndCardOverlay
            takeaway={endCardText}
            beats={endCardBeats}
            cta={endCardCta}
            variant={variant}
          />
        </Sequence>
      )}
    </>
  );
};

const HookOverlay: React.FC<{
  text: string;
  variant: OverlayVariant;
  holdFrames: number;
}> = ({ text, variant, holdFrames }) => {
  const frame = useCurrentFrame();
  const fadeOutStart = Math.max(10, holdFrames - 8);
  const opacity = interpolate(
    frame,
    [0, 4, fadeOutStart, holdFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const scale = interpolate(frame, [0, 8], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "rgba(4, 6, 12, 0.82)",
        justifyContent: "center",
        alignItems: "center",
        padding: isPortrait ? 72 : 64,
        opacity,
        pointerEvents: "none",
      }}
    >
      <p
        style={{
          margin: 0,
          transform: `scale(${scale})`,
          fontFamily,
          fontWeight: 900,
          fontSize: isPortrait ? "6.2em" : "4.8em",
          lineHeight: 0.98,
          color: "white",
          textAlign: "center",
          textTransform: "uppercase",
          WebkitTextStroke: "2px black",
          textShadow: "0 10px 32px rgba(0,0,0,0.8)",
        }}
      >
        {text}
      </p>
    </AbsoluteFill>
  );
};

const EndCardOverlay: React.FC<{
  takeaway: string;
  beats: string[];
  cta?: string;
  variant: OverlayVariant;
}> = ({ takeaway, beats, cta, variant }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const isPortrait = variant === "portrait";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "rgba(0,0,0,0.62)",
        justifyContent: "center",
        alignItems: "center",
        padding: isPortrait ? 80 : 64,
        opacity,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily,
          fontWeight: 900,
          fontSize: isPortrait ? "4.4em" : "3.6em",
          lineHeight: 1.1,
          color: "white",
          textAlign: "center",
          textTransform: "uppercase",
          WebkitTextStroke: "2px black",
          textShadow: "0 8px 24px rgba(0,0,0,0.7)",
        }}
      >
        {takeaway}
      </p>
      {beats.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 16,
            marginTop: 36,
          }}
        >
          {beats.map((beat) => (
            <div
              key={beat}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: "2px solid white",
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily,
                  fontWeight: 800,
                  fontSize: isPortrait ? "1.8em" : "1.5em",
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                {beat}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {cta ? (
        <div
          style={{
            marginTop: 48,
            padding: "18px 42px",
            borderRadius: 999,
            backgroundColor: "white",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily,
              fontWeight: 800,
              fontSize: isPortrait ? "2.1em" : "1.8em",
              color: "black",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {cta}
          </p>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
