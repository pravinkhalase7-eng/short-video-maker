import { z } from "zod";
import { ShortVideo } from "./ShortVideo";
import { shortVideoSchema } from "../utils";

export const PortraitVideo: React.FC<z.infer<typeof shortVideoSchema>> = (
  props,
) => <ShortVideo {...props} variant="portrait" />;
