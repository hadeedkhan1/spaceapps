# spaceapps

## Run both servers

```
bun install
cd client && bun install && cd ..
bun run dev
```

API: http://127.0.0.1:8000 · App: http://localhost:5173

The dev command starts FastAPI and Vite together; Ctrl+C stops both. To run them separately, use `bun run dev:api` and `bun run dev:web`.

Backend dependencies: `pip install -r backend/requirements.txt`. Set the keys in `.env` (see `.env.example`).

For live NASA/research citations on flagged alerts, set `SERPAPI_API_KEY` in `.env`. Search results are cached by query for the backend process lifetime. If the key is missing or SerpApi is unavailable, the alert labels and shows curated research links instead.
