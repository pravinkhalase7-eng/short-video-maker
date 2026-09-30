import { AbsoluteFill } from "remotion";
import { INSTAGRAM_REEL, snippetFilename } from "../utils";
import { VsCodeSnippetWindow } from "./ExampleCard";

export const CodeSnippetPoster: React.FC<{
  code: string;
  filename?: string;
}> = ({ code, filename }) => {
  const tab = filename || snippetFilename(code);
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 28%, #3a3f55 0%, #1a1d28 55%, #0f1118 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: INSTAGRAM_REEL.safeTop + 40,
          left: INSTAGRAM_REEL.safeLeft,
          right: INSTAGRAM_REEL.safeRight,
          bottom: INSTAGRAM_REEL.safeBottom,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <VsCodeSnippetWindow
          code={code}
          filename={tab}
          isPortrait
          maxLines={18}
        />
      </div>
    </AbsoluteFill>
  );
};
