import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Snackbar,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { VideoStatus } from "../../types/shorts";

type VideoDetailsData = {
  status: VideoStatus;
  prompt?: string;
  title?: string;
  caption?: string;
  explanation?: string;
  hashtags?: string[];
  instagramText?: string;
};

const VideoDetails: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoStatus>("processing");
  const [details, setDetails] = useState<VideoDetailsData | null>(null);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  const checkVideoStatus = async () => {
    try {
      const response = await axios.get(`/api/short-video/${videoId}/status`);
      const videoStatus = response.data.status as VideoStatus;

      if (isMounted.current) {
        setStatus(videoStatus || "unknown");
        setDetails(response.data);
        if (videoStatus !== "processing") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
        setLoading(false);
      }
    } catch (fetchError) {
      if (isMounted.current) {
        setError("Failed to fetch video status");
        setStatus("failed");
        setLoading(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }
  };

  useEffect(() => {
    checkVideoStatus();
    intervalRef.current = setInterval(() => {
      checkVideoStatus();
    }, 5000);
    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [videoId]);

  const handleBack = () => {
    navigate("/");
  };

  const handleCopy = async () => {
    const text = details?.instagramText?.trim();
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const renderPostPack = () => {
    if (!(details?.title || details?.prompt)) {
      if (status !== "ready") {
        return null;
      }
      return (
        <Alert severity="info" sx={{ mb: 3, textAlign: "left" }}>
          No saved prompt for this video. New videos will show the title,
          caption, hashtags, and a copy button here.
        </Alert>
      );
    }

    return (
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, textAlign: "left" }}>
        {details.title ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Instagram title
            </Typography>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {details.title}
            </Typography>
          </>
        ) : null}
        {details.prompt ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Prompt you entered
            </Typography>
            <Typography
              variant="body1"
              sx={{ whiteSpace: "pre-wrap", mb: 2 }}
            >
              {details.prompt}
            </Typography>
          </>
        ) : null}
        {details.caption ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Caption
            </Typography>
            <Typography
              variant="body1"
              sx={{ whiteSpace: "pre-wrap", mb: 2 }}
            >
              {details.caption}
            </Typography>
          </>
        ) : null}
        {details.explanation ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Explanation
            </Typography>
            <Typography
              variant="body1"
              sx={{ whiteSpace: "pre-wrap", mb: 2 }}
            >
              {details.explanation}
            </Typography>
          </>
        ) : null}
        {details.hashtags?.length ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {details.hashtags.map((tag) => (
              <Chip key={tag} label={tag} size="small" />
            ))}
          </Box>
        ) : null}
        {details.instagramText ? (
          <Button
            variant="contained"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopy}
          >
            Copy Instagram caption
          </Button>
        ) : null}
      </Paper>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="30vh">
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }

    if (status === "processing") {
      return (
        <Box textAlign="center" py={4}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">Your video is being created...</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            This may take a few minutes. Please wait.
          </Typography>
          {renderPostPack()}
        </Box>
      );
    }

    if (status === "ready") {
      return (
        <Box>
          <Box mb={3} textAlign="center">
            <Typography variant="h6" color="success.main" gutterBottom>
              Your video is ready!
            </Typography>
          </Box>

          <Box
            sx={{
              position: "relative",
              paddingTop: "56.25%",
              mb: 3,
              backgroundColor: "#000",
            }}
          >
            <video
              controls
              autoPlay
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
              src={`/api/short-video/${videoId}`}
            />
          </Box>

          {renderPostPack()}

          <Box textAlign="center">
            <Button
              component="a"
              href={`/api/short-video/${videoId}`}
              download
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              sx={{ textDecoration: "none" }}
            >
              Download Video
            </Button>
          </Box>
        </Box>
      );
    }

    if (status === "failed") {
      return (
        <Alert severity="error" sx={{ mb: 3 }}>
          Video processing failed. Please try again with different settings.
        </Alert>
      );
    }

    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        Unknown video status. Please try refreshing the page.
      </Alert>
    );
  };

  const capitalizeFirstLetter = (str: string) => {
    if (!str || typeof str !== "string") return "Unknown";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <Box maxWidth="md" mx="auto" py={4}>
      <Box display="flex" alignItems="center" mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mr: 2 }}>
          Back to videos
        </Button>
        <Typography variant="h4" component="h1">
          Video Details
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Video ID
            </Typography>
            <Typography variant="body1">{videoId || "Unknown"}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Status
            </Typography>
            <Typography
              variant="body1"
              color={
                status === "ready"
                  ? "success.main"
                  : status === "processing"
                    ? "info.main"
                    : status === "failed"
                      ? "error.main"
                      : "text.primary"
              }
            >
              {capitalizeFirstLetter(status)}
            </Typography>
          </Grid>
        </Grid>

        {renderContent()}
      </Paper>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="Copied. Paste it into Instagram."
      />
    </Box>
  );
};

export default VideoDetails;
