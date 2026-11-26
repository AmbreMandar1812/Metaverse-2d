# Mosaic frontend

The frontend provides account sign-in/sign-up, a space dashboard, two space
templates (Sunlit Grove and Moonlight Arcade), and a multiplayer room with
three placeable decorations.

## Run locally

From the monorepo root, apply database migrations and start the HTTP API,
WebSocket server, and Vite frontend in separate terminals:

```sh
pnpm --filter @repo/db exec prisma migrate deploy
pnpm --filter http dev
pnpm --filter ws dev
pnpm --filter frontend dev
```

The frontend proxies `/api` to the HTTP server on port 3000 and `/ws` to the
WebSocket server on port 3001. Set `VITE_API_URL` or `VITE_WS_URL` to override
those defaults for a different deployment.

The default decoration records are added by the database migration and their
SVGs are served from `apps/frontend/public/elements`.
