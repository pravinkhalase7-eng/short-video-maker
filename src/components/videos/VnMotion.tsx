import type { ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

export const VN_EASE = Easing.out(Easing.cubic);

export type VnEnter = {
  opacity: number;
  x: number;
  y: number;
  scale: number;
};

export function vnProgress(
  frame: number,
  start: number,
  duration: number,
  poster = false,
): number {
  if (poster) {
    return 1;
  }
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: VN_EASE,
  });
}

export function vnOpacity(
  frame: number,
  start: number,
  fade = 5,
  poster = false,
): number {
  if (poster) {
    return 1;
  }
  return interpolate(frame, [start, start + fade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function vnEnter(
  frame: number,
  start: number,
  opts: {
    duration?: number;
    fromX?: number;
    fromY?: number;
    fromScale?: number;
    poster?: boolean;
  } = {},
): VnEnter {
  const duration = opts.duration ?? 12;
  const t = vnProgress(frame, start, duration, opts.poster);
  const fromScale = opts.fromScale ?? 1;
  return {
    opacity: vnOpacity(frame, start, 5, opts.poster),
    x: (opts.fromX ?? 0) * (1 - t),
    y: (opts.fromY ?? 0) * (1 - t),
    scale: fromScale + (1 - fromScale) * t,
  };
}

export function vnTransform(enter: VnEnter): string {
  return `translate(${enter.x}px, ${enter.y}px) scale(${enter.scale})`;
}

export const VnFlashWipe: React.FC<{ play?: boolean }> = ({ play = true }) => {
  const frame = useCurrentFrame();
  if (!play) {
    return null;
  }
  const cover = interpolate(frame, [0, 4, 11], [0, 1.18, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: VN_EASE,
  });
  if (cover <= 0.02) {
    return null;
  }
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 50,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "170%",
          height: "48%",
          background:
            "linear-gradient(90deg, #F5C518 0%, #fff4a8 48%, #F5C518 100%)",
          transform: `scaleX(${cover}) rotate(-12deg)`,
          transformOrigin: "center",
          mixBlendMode: "screen",
          boxShadow: "0 0 90px rgba(245,197,24,0.75)",
        }}
      />
    </AbsoluteFill>
  );
};

export const VnZoomPunch: React.FC<{
  play: boolean;
  children: ReactNode;
}> = ({ play, children }) => {
  const frame = useCurrentFrame();
  const scale = play
    ? interpolate(frame, [0, 12], [1.14, 1.03], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: VN_EASE,
      })
    : 1;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
