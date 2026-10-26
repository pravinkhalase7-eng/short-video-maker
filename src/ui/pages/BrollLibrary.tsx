import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

type BrollClip = {
  id: string;
  kind: "video" | "image";
  file: string;
  url: string;
  terms: string[];
  orientation?: string;
};

const BrollLibrary: React.FC = () => {
  const [clips, setClips] = useState<BrollClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await axios.get("/api/broll");
        setClips(response.data.clips || []);
      } catch (err) {
        setError("Failed to load downloaded B-roll.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const absoluteUrl = (url: string) =>
    `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;

  const handleCopy = async (url: string) => {
    const link = absoluteUrl(url);
    await navigator.clipboard.writeText(link);
    setCopied(link);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="lg" mx="auto" py={4}>
      <Typography variant="h4" component="h1" gutterBottom>
        Downloaded B-roll
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These stills and clips stay on disk after a story video downloads them.
        Later videos reuse them. Open a link or copy it.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {copied ? (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setCopied(null)}>
          Copied {copied}
        </Alert>
      ) : null}

      {clips.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            No B-roll yet. Create a story video first — quiz videos skip stock
            clips.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {clips.map((clip) => (
            <Grid item xs={12} sm={6} md={4} key={clip.id}>
              <Paper sx={{ p: 2, height: "100%" }}>
                <Box
                  sx={{
                    aspectRatio: "9 / 16",
                    maxHeight: 280,
                    mx: "auto",
                    mb: 1.5,
                    overflow: "hidden",
                    borderRadius: 1,
                    bgcolor: "#111",
                  }}
                >
                  {clip.kind === "video" ? (
                    <Box
                      component="video"
                      src={clip.url}
                      controls
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Box
                      component="img"
                      src={clip.url}
                      alt={clip.terms.join(" ") || clip.id}
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                </Box>
                <Typography variant="subtitle2" noWrap title={clip.id}>
                  {clip.id}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1, wordBreak: "break-all" }}
                >
                  {absoluteUrl(clip.url)}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
                  {clip.orientation ? (
                    <Chip size="small" label={clip.orientation} />
                  ) : null}
                  {clip.terms.map((term) => (
                    <Chip size="small" key={`${clip.id}-${term}`} label={term} />
                  ))}
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<OpenInNewIcon />}
                    href={clip.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    href={clip.url}
                    download={clip.file}
                  >
                    Download
                  </Button>
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => handleCopy(clip.url)}
                  >
                    Copy link
                  </Button>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default BrollLibrary;
