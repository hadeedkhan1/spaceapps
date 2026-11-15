# Orbital Twin web app (Person B)
Run: `bun install && bun run dev`. Needs the backend running (see ../backend).
To test the /api function locally use `bunx vercel dev`.
Deploy: push to GitHub (commit bun.lock), import in Vercel, add env vars from .env.example.
Note: /api functions run on Vercel's default Node runtime; bun is used for install, dev and build.
Hooking up Person A: set VITE_API_URL to the FastAPI base URL (default http://127.0.0.1:8000). The app signs in through /signup and /login, posts /readings, and reads /status.
Not built yet: inbound reply webhook (needs a store such as Vercel KV), PWA manifest, ESP32 input.
