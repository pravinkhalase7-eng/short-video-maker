import { z } from "zod";
import { ShortVideo } from "./ShortVideo";
import { shortVideoSchema } from "../utils";

export const LandscapeVideo: React.FC<z.infer<typeof shortVideoSchema>> = (
  props,
) => <ShortVideo {...props} variant="landscape" />;
