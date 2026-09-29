import { AbsoluteFill } from "remotion";
import { quizSeriesBadge } from "../utils";
import { ExampleCardOverlay } from "./ExampleCard";
import { QuizDeskBackground } from "./SceneMotion";

export const QuizPoster: React.FC<{
  title?: string;
  body: string;
  answer?: string;
}> = ({ title, body, answer }) => {
  return (
    <AbsoluteFill>
      <QuizDeskBackground lang={quizSeriesBadge({ title, body })} />
      <ExampleCardOverlay
        card={{ title, body, kind: "quiz" }}
        answerLetter={answer}
        variant="portrait"
        delayFrames={0}
        sceneFrames={60}
        optionFrom={0}
        optionStep={0}
        poster
      />
    </AbsoluteFill>
  );
};
