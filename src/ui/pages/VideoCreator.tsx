import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  SceneInput,
  RenderConfig,
  MusicMoodEnum,
  CaptionPositionEnum,
  VoiceEnum,
  OrientationEnum,
  MusicVolumeEnum,
  TARGET_DURATION_SECONDS,
  TargetDurationSec,
  VideoFormat,
} from "../../types/shorts";

interface SceneFormData {
  text: string;
  searchTerms: string;
  overlayText: string;
  exampleCardTitle: string;
  exampleCardBody: string;
  holdMs: string;
}

const emptyScene = (): SceneFormData => ({
  text: "",
  searchTerms: "",
  overlayText: "",
  exampleCardTitle: "",
  exampleCardBody: "",
  holdMs: "",
});

const VideoCreator: React.FC = () => {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState<SceneFormData[]>([emptyScene()]);
  const [config, setConfig] = useState<RenderConfig>({
    paddingBack: 2500,
    music: MusicMoodEnum.chill,
    captionPosition: CaptionPositionEnum.bottom,
    captionBackgroundColor: "blue",
    voice: VoiceEnum.af_heart,
    orientation: OrientationEnum.portrait,
    musicVolume: MusicVolumeEnum.low,
    hookText: "",
    hookDurationMs: 2200,
    endCardText: "",
    endCardCta: "Follow for more",
    targetDurationSec: 30,
    format: "story",
  });

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [voices, setVoices] = useState<VoiceEnum[]>([]);
  const [musicTags, setMusicTags] = useState<MusicMoodEnum[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [voicesResponse, musicResponse] = await Promise.all([
          axios.get("/api/voices"),
          axios.get("/api/music-tags"),
        ]);

        setVoices(voicesResponse.data);
        setMusicTags(musicResponse.data);
      } catch (err) {
        console.error("Failed to fetch options:", err);
        setError(
          "Failed to load voices and music options. Please refresh the page.",
        );
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleAddScene = () => {
    setScenes([
      ...scenes,
      emptyScene(),
    ]);
  };

  const handleRemoveScene = (index: number) => {
    if (scenes.length > 1) {
      const newScenes = [...scenes];
      newScenes.splice(index, 1);
      setScenes(newScenes);
    }
  };

  const handleSceneChange = (
    index: number,
    field: keyof SceneFormData,
    value: string,
  ) => {
    const newScenes = [...scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    setScenes(newScenes);
  };

  const handleConfigChange = (field: keyof RenderConfig, value: any) => {
    setConfig({ ...config, [field]: value });
  };

  const handleGenerateFromPrompt = async () => {
    if (prompt.trim().length < 8) {
      setError(
        "Write a short description of the video you want (at least 8 characters).",
      );
      return;
    }

    setGenerating(true);
    setScriptReady(false);
    setError(null);
    setSuccess(null);

    try {
      const pastedQuiz =
        /(?:^|\n)\s*A[)\]:.\-]\s+\S/.test(prompt) &&
        /(?:^|\n)\s*B[)\]:.\-]\s+\S/.test(prompt);
      const response = await axios.post("/api/generate-script", {
        prompt: prompt.trim(),
        targetDurationSec: config.targetDurationSec ?? 30,
        format: pastedQuiz ? "quiz" : config.format ?? "story",
      });
      const generated = response.data as {
        scenes: SceneInput[];
        config: RenderConfig;
        source?: "llm" | "local";
      };

      setScenes(
        generated.scenes.map((scene) => ({
          text: scene.text,
          searchTerms: scene.searchTerms.join(", "),
          overlayText: scene.overlayText ?? "",
          exampleCardTitle: scene.exampleCard?.title ?? "",
          exampleCardBody: scene.exampleCard?.body ?? "",
          holdMs: scene.holdMs ? String(scene.holdMs) : "",
        })),
      );
      setConfig({
        paddingBack: generated.config.paddingBack ?? 2500,
        music: generated.config.music ?? MusicMoodEnum.chill,
        captionPosition:
          generated.config.captionPosition ?? CaptionPositionEnum.bottom,
        captionBackgroundColor:
          generated.config.captionBackgroundColor ?? "blue",
        voice: generated.config.voice ?? VoiceEnum.af_heart,
        orientation: generated.config.orientation ?? OrientationEnum.portrait,
        musicVolume: generated.config.musicVolume ?? MusicVolumeEnum.low,
        hookText:
          generated.config.format === "quiz"
            ? ""
            : generated.config.hookText ?? "",
        hookDurationMs:
          generated.config.format === "quiz"
            ? 0
            : generated.config.hookDurationMs ?? 2200,
        endCardText: generated.config.endCardText ?? "",
        endCardCta: generated.config.endCardCta ?? "Follow for more",
        endCardBeats: generated.config.endCardBeats,
        targetDurationSec:
          generated.config.targetDurationSec ?? config.targetDurationSec ?? 30,
        format: generated.config.format ?? config.format ?? "story",
      });
      setScriptReady(true);
      setSuccess(
        generated.source === "local"
          ? generated.config.format === "quiz" && /A[)\]:.\-]\s+\S/.test(prompt)
            ? "Your pasted question was kept. Review the answer, then click Create Video."
            : generated.config.format === "quiz"
            ? "One quiz question filled. Review it, then click Create Video."
            : "Draft scenes and end card filled. Review them, then click Create Video."
          : generated.config.format === "quiz"
            ? "One quiz question, options, and the answer generated. Review them, then click Create Video."
            : "Hook, scenes, takeaway, and settings generated. Review them, then click Create Video.",
      );
    } catch (err) {
      setError(
        "Failed to generate scenes from the prompt. Try again, or fill the form manually.",
      );
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!scriptReady || loading || generating) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Convert scenes to the expected API format
      const apiScenes: SceneInput[] = scenes.map((scene) => ({
        text: scene.text,
        searchTerms: scene.searchTerms
          .split(",")
          .map((term) => term.trim())
          .filter((term) => term.length > 0),
        overlayText: scene.overlayText.trim() || undefined,
        holdMs: scene.holdMs.trim() ? parseInt(scene.holdMs, 10) : undefined,
        exampleCard: scene.exampleCardBody.trim()
          ? {
              title: scene.exampleCardTitle.trim() || undefined,
              body: scene.exampleCardBody.trim(),
              kind: inferCardKind(
                scene.exampleCardTitle,
                scene.exampleCardBody,
              ),
            }
          : undefined,
      }));

      const response = await axios.post("/api/short-video", {
        scenes: apiScenes,
        prompt: prompt.trim() || undefined,
        config:
          config.format === "quiz"
            ? {
                ...config,
                hookText: undefined,
                hookDurationMs: 0,
              }
            : config,
      });

      navigate(`/video/${response.data.videoId}`);
    } catch (err) {
      setError("Failed to create video. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingOptions) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="md" mx="auto" py={4}>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Video
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4, bgcolor: "#f8fbff" }}>
        <Typography variant="h6" gutterBottom>
          Describe your video
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose a length and format, then enter a topic — or paste a full
          question with a snippet and A B C D options. Generate fills the
          spoken scenes, cards, and takeaway. You can edit anything
          before creating the video. Longer videos take more time to render.
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={7}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Length
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              color="primary"
              value={config.targetDurationSec ?? 30}
              onChange={(_event, value: TargetDurationSec | null) => {
                if (value) {
                  handleConfigChange("targetDurationSec", value);
                }
              }}
            >
              {TARGET_DURATION_SECONDS.map((seconds) => (
                <ToggleButton key={seconds} value={seconds}>
                  {seconds}s
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Grid>
          <Grid item xs={12} sm={5}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Format
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              color="primary"
              value={config.format ?? "story"}
              onChange={(_event, value: VideoFormat | null) => {
                if (value) {
                  setScriptReady(false);
                  setConfig((prev) => ({
                    ...prev,
                    format: value,
                    ...(value === "quiz"
                      ? { hookText: "", hookDurationMs: 0 }
                      : {}),
                  }));
                }
              }}
            >
              <ToggleButton value="story">Story</ToggleButton>
              <ToggleButton value="quiz">Quiz</ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
        <TextField
          fullWidth
          multiline
          minRows={config.format === "quiz" ? 8 : 3}
          label={config.format === "quiz" ? "Quiz topic or pasted question" : "Prompt"}
          placeholder={
            config.format === "quiz"
              ? "1. What is the output?\nx = [1, 2, 3]\ny = x\ny.append(4)\nprint(x)\n\nA) [1, 2, 3]\nB) [1, 2, 3, 4]\nC) [4, 1, 2, 3]\nD) Error"
              : "A 30-second portrait video about morning coffee and starting a focused day. Chill music, female voice."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          helperText={
            config.format === "quiz"
              ? "Paste a full question with code and A–D options, or type a topic like Java 8 lambdas."
              : "Describe the short. Generate will size the script to the length you picked."
          }
          inputProps={{ maxLength: 4000 }}
        />
        <Box display="flex" justifyContent="flex-end" mt={2}>
          <Button
            type="button"
            variant="contained"
            startIcon={
              generating ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <AutoAwesomeIcon />
              )
            }
            onClick={handleGenerateFromPrompt}
            disabled={generating || loading}
          >
            {generating
              ? "Generating..."
              : config.format === "quiz"
                ? "Generate quiz"
                : "Generate scenes"}
          </Button>
        </Box>
      </Paper>

      {scriptReady ? (
        <Box display="flex" justifyContent="center" sx={{ mb: 4 }}>
          <Button
            type="button"
            variant="contained"
            color="primary"
            size="large"
            disabled={loading || generating}
            onClick={() => handleSubmit()}
            sx={{ minWidth: 200 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Create Video"
            )}
          </Button>
        </Box>
      ) : null}

      <form onSubmit={handleSubmit}>
        <Typography variant="h5" component="h2" gutterBottom>
          {config.format === "quiz" ? "End card" : "Hook and end card"}
        </Typography>
        <Paper sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={3}>
            {config.format === "quiz" ? null : (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="On-screen hook"
                  value={config.hookText || ""}
                  onChange={(e) => handleConfigChange("hookText", e.target.value)}
                  helperText="4-8 words shown in the first seconds. A question or bold claim."
                  inputProps={{ maxLength: 60 }}
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="End-card takeaway"
                value={config.endCardText || ""}
                onChange={(e) =>
                  handleConfigChange("endCardText", e.target.value)
                }
                helperText="One line shown after the last spoken scene."
                inputProps={{ maxLength: 90 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End-card call to action"
                value={config.endCardCta || ""}
                onChange={(e) =>
                  handleConfigChange("endCardCta", e.target.value)
                }
                placeholder="Follow for more"
                inputProps={{ maxLength: 40 }}
              />
            </Grid>
            {config.format === "quiz" ? null : (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Hook duration (ms)"
                  value={config.hookDurationMs ?? 2200}
                  onChange={(e) =>
                    handleConfigChange(
                      "hookDurationMs",
                      parseInt(e.target.value),
                    )
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">ms</InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}
          </Grid>
        </Paper>

        <Typography variant="h5" component="h2" gutterBottom>
          Scenes
        </Typography>

        {scenes.map((scene, index) => (
          <Paper key={index} sx={{ p: 3, mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">Scene {index + 1}</Typography>
              {scenes.length > 1 && (
                <IconButton
                  onClick={() => handleRemoveScene(index)}
                  color="error"
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Text"
                  multiline
                  rows={4}
                  value={scene.text}
                  onChange={(e) =>
                    handleSceneChange(index, "text", e.target.value)
                  }
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Search Terms (comma-separated)"
                  value={scene.searchTerms}
                  onChange={(e) =>
                    handleSceneChange(index, "searchTerms", e.target.value)
                  }
                  helperText="Enter keywords for background video, separated by commas"
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="On-screen punch"
                  value={scene.overlayText}
                  onChange={(e) =>
                    handleSceneChange(index, "overlayText", e.target.value)
                  }
                  helperText="Used only if there is no example card. A number or 1-3 words."
                  inputProps={{ maxLength: 18 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Card title"
                  value={scene.exampleCardTitle}
                  onChange={(e) =>
                    handleSceneChange(index, "exampleCardTitle", e.target.value)
                  }
                  helperText="USA Quiz, or A/B/C for the answer."
                  inputProps={{ maxLength: 24 }}
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Example card"
                  multiline
                  rows={4}
                  value={scene.exampleCardBody}
                  onChange={(e) =>
                    handleSceneChange(index, "exampleCardBody", e.target.value)
                  }
              helperText="Question, optional code, then A) B) C) D) outputs"
                  inputProps={{ maxLength: 640 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Think pause (ms)"
                  value={scene.holdMs}
                  onChange={(e) =>
                    handleSceneChange(index, "holdMs", e.target.value)
                  }
                  helperText="Extra hold after speech. Use ~11000 on the quiz question so viewers can think."
                />
              </Grid>
            </Grid>
          </Paper>
        ))}

        <Box display="flex" justifyContent="center" mb={4}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddScene}
          >
            Add Scene
          </Button>
        </Box>

        <Divider sx={{ mb: 4 }} />

        <Typography variant="h5" component="h2" gutterBottom>
          Video Configuration
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="End Screen Padding (ms)"
                value={config.paddingBack}
                onChange={(e) =>
                  handleConfigChange("paddingBack", parseInt(e.target.value))
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">ms</InputAdornment>
                  ),
                }}
                helperText="End card length after narration. 2500 ms is a good read time."
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Music Mood</InputLabel>
                <Select
                  value={config.music}
                  onChange={(e) => handleConfigChange("music", e.target.value)}
                  label="Music Mood"
                  required
                >
                  {Object.values(MusicMoodEnum).map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Caption Position</InputLabel>
                <Select
                  value={config.captionPosition}
                  onChange={(e) =>
                    handleConfigChange("captionPosition", e.target.value)
                  }
                  label="Caption Position"
                  required
                >
                  {Object.values(CaptionPositionEnum).map((position) => (
                    <MenuItem key={position} value={position}>
                      {position}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Caption Background Color"
                value={config.captionBackgroundColor}
                onChange={(e) =>
                  handleConfigChange("captionBackgroundColor", e.target.value)
                }
                helperText="Any valid CSS color (name, hex, rgba)"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Default Voice</InputLabel>
                <Select
                  value={config.voice}
                  onChange={(e) => handleConfigChange("voice", e.target.value)}
                  label="Default Voice"
                  required
                >
                  {Object.values(VoiceEnum).map((voice) => (
                    <MenuItem key={voice} value={voice}>
                      {voice}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Orientation</InputLabel>
                <Select
                  value={config.orientation}
                  onChange={(e) =>
                    handleConfigChange("orientation", e.target.value)
                  }
                  label="Orientation"
                  required
                >
                  {Object.values(OrientationEnum).map((orientation) => (
                    <MenuItem key={orientation} value={orientation}>
                      {orientation}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Volume of the background audio</InputLabel>
                <Select
                  value={config.musicVolume}
                  onChange={(e) =>
                    handleConfigChange("musicVolume", e.target.value)
                  }
                  label="Volume of the background audio"
                  required
                >
                  {Object.values(MusicVolumeEnum).map((voice) => (
                    <MenuItem key={voice} value={voice}>
                      {voice}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

      </form>
    </Box>
  );
};

export default VideoCreator;

function inferCardKind(
  title: string,
  body: string,
): "code" | "fact" | "quiz" {
  if (
    /^Q\d+$/i.test(title.trim()) ||
    /^[A-D]$/i.test(title.trim()) ||
    /quiz$/i.test(title.trim()) ||
    /(?:^|\n)\s*[A-D][).:\-]\s+\S+/i.test(body)
  ) {
    return "quiz";
  }
  if (/[{};=>]|function\s|\bclass\s|\bpublic\s/.test(body)) {
    return "code";
  }
  return "fact";
}
