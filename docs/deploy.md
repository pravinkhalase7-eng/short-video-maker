# Deploy to VPS (Jenkins)

This project follows the same Jenkins → Docker Compose pattern as **auto-reader / AI Teacher**.

## What Jenkins does

1. Checkout repo
2. Load secrets from Jenkins credential `shortvideo-env-file`
3. Build `shortvideo-app` from `main-tiny.Dockerfile` (tiny Whisper + q4 Kokoro)
4. Smoke-test that `dist/index.js` and the UI build exist in the image
5. `docker compose up -d` on the VPS agent
6. Health-check via `docker exec shortvideo-app curl .../health`

This app is a **single container**: UI + REST + MCP on port **3123**.

## Public domain (doxstation.com)

Host **:80/:443** is owned by **aicoder-nginx**. Short Video Maker does **not** bind port 80.

Direct access (same as AI Teacher’s `:3000` / `:8000`):

| Service | URL |
|---------|-----|
| UI + API | `http://YOUR_VPS_IP:3123` |
| Health | `http://YOUR_VPS_IP:3123/health` |
| Create UI | `http://YOUR_VPS_IP:3123/create` |

Optional: add a host in `aicoder-nginx` that proxies `shorts.doxstation.com` → `host.docker.internal:3123`. Do not run a second nginx on host :80.

## Jenkins setup

1. Install Docker + Docker Compose on the Jenkins agent (or Jenkins-in-Docker with Docker socket mount — same as auto-reader).
2. Create a Pipeline job pointing at this repo’s `Jenkinsfile`.
3. Create credential:
   - **Kind:** Secret file
   - **ID:** `shortvideo-env-file` (exact)
   - **Contents:** filled copy of [`shortvideo.env.example`](../shortvideo.env.example)
4. Set in that file:
   - `PEXELS_API_KEY` (required)
   - `PIXABAY_API_KEY` / `GEMINI_API_KEY` if you use them
   - `APP_HOST_PORT=3123`
5. Run the job. Optional parameters:
   - `SKIP_DEPLOY` — build + smoke only
   - `FORCE_RECREATE` — recreate containers
   - `RESET_DATA` — **leave unchecked**. Checking it deletes rendered videos.

## After deploy

| Service | URL |
|---------|-----|
| UI (direct) | `http://187.127.138.86:3123` |
| Health | `http://187.127.138.86:3123/health` |
| Create | `http://187.127.138.86:3123/create` |

## Manual deploy (without Jenkins)

```bash
cp shortvideo.env.example .env
# edit .env — set PEXELS_API_KEY

export IMAGE_TAG=manual
docker compose build
docker compose up -d
docker compose ps
docker exec shortvideo-app curl -fsS http://127.0.0.1:3123/health
```

## Notes

- The tiny image is used on purpose: VPS RAM is limited, Remotion concurrency stays at 1.
- Videos persist in Docker volume `shortvideo_videos`. Whisper models stay in the image (not on that volume).
- First container start can take 1–2 minutes (Kokoro + Chrome). Healthcheck `start_period` is 120s.
- Do not bind-mount Jenkins workspace paths into containers when Jenkins runs inside Docker (same constraint as auto-reader).
