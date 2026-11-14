# Orbital Twin web app (Person B)
Run: `npm install && npm run dev` (mock data works with no backend).
To test the /api function locally use `npx vercel dev`.
Deploy: push to GitHub, import in Vercel, add env vars from .env.example.
Hooking up Person A: set VITE_API_URL; /state must match src/contract.ts.
Not built yet: inbound reply webhook (needs a store such as Vercel KV), PWA manifest, ESP32 input.
