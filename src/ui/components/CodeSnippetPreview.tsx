import React, { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

export const CodeSnippetPreview: React.FC<{
  title: string;
  filename: string;
  code: string;
  onChange?: (code: string) => void;
}> = ({ title, filename, code, onChange }) => {
  const editable = Boolean(onChange);
  const [draft, setDraft] = useState(code);
  const focused = useRef(false);
  const lines = (editable ? draft : code).split(/\r?\n/);
  const language = filename.endsWith(".java")
    ? "Java"
    : filename.endsWith(".js")
      ? "JavaScript"
      : "Python";

  useEffect(() => {
    if (!focused.current) {
      setDraft(code);
    }
  }, [code]);

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {title} · {filename}
        {editable ? " · edit the program, then Create Video" : ""}
      </Typography>
      <Box
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "#1e1e1e",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 1,
            bgcolor: "#3c3c3c",
          }}
        >
          {["#ff5f56", "#ffbd2e", "#27c93f"].map((color) => (
            <Box
              key={color}
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: color,
              }}
            />
          ))}
          <Typography
            sx={{
              ml: 1,
              color: "#d4d4d4",
              fontSize: 12,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {filename} — Visual Studio Code
          </Typography>
        </Box>
        {editable ? (
          <Box
            component="textarea"
            value={draft}
            spellCheck={false}
            onFocus={() => {
              focused.current = true;
            }}
            onBlur={() => {
              focused.current = false;
            }}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              onChange?.(next);
            }}
            sx={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              m: 0,
              px: 2,
              py: 1.5,
              minHeight: 220,
              border: 0,
              outline: 0,
              resize: "vertical",
              bgcolor: "#1e1e1e",
              color: "#d4d4d4",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre",
              overflow: "auto",
            }}
          />
        ) : (
          <Box
            component="pre"
            sx={{
              m: 0,
              px: 2,
              py: 1.5,
              minHeight: 140,
              color: "#d4d4d4",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {lines.slice(0, 16).map((line, index) => (
              <Box key={`${filename}-${index}`} component="span" sx={{ display: "block" }}>
                <Box
                  component="span"
                  sx={{ color: "#858585", display: "inline-block", width: 28 }}
                >
                  {index + 1}
                </Box>
                {line || " "}
              </Box>
            ))}
          </Box>
        )}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            px: 1.5,
            py: 0.75,
            bgcolor: "#007acc",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span>{language}</span>
          <span>{`UTF-8  Ln ${Math.max(1, lines.length)}`}</span>
        </Box>
      </Box>
    </Box>
  );
};
