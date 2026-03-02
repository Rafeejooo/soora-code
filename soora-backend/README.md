# Soora Backend

Express + TypeScript orchestrator that sits between the frontend (Vercel) and the Consumet API + TMDB.  
Reduces frontend API calls from **16+ per page** to **1 per page** with server-side caching and parallel execution.

## Architecture

```
[Frontend @ Vercel]
        │
        ▼  (1 request per page)
[Soora Backend :4000]
   ├── Cache (node-cache)
   ├── Parallel orchestration
   ├── Multi-provider fallback
   └── Passthrough for unmapped routes
        │
        ▼
[Consumet API :3000]  +  [TMDB API]
```

## Key Endpoints

| Endpoint | Replaces | Calls Combined |
|---|---|---|
| `GET /anime/home` | 16+ frontend calls (spotlight + recent + popular + airing + 12 genres) | 16 → 1 |
| `GET /anime/search?q=` | 3 parallel searches (AnimeKai + HiAnime + AnimePahe) with dedup | 3 → 1 |
| `GET /anime/info/:id` | AnimeKai info + HiAnime info + Jikan MAL lookup | 3 → 1 |
| `GET /anime/watch/:episodeId` | Fallback chain AnimeKai → HiAnime → AnimePahe | up to 9 → 1 |
| `GET /movies/home` | TMDB trending/popular + Goku trending/recent + LK21 + genre discover | 20+ → 1 |
| `GET /movies/stream` | Search + match + info + watch across providers | up to 12 → 1 |
| `GET /manga/home` | MangaPill popular + Komiku trending | 2 → 1 |
| `GET /*` (passthrough) | Forwards to Consumet for backward-compat | 1 → 1 |

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env — set CONSUMET_URL=http://localhost:3000 if running Consumet locally

# Dev mode (ts-node with watch)
npm run dev

# Build
npm run build

# Production
npm start
```

## VPS Deployment (Docker Compose)

```bash
# On your VPS, from the soora-code/ directory:
cd soora-backend

# Build and start both Consumet + Backend
docker compose up -d --build

# Check status
docker compose ps
docker compose logs -f soora-backend
```

### Nginx Configuration

Update your nginx config so `api.soora.fun` routes to the backend (port 4000) instead of Consumet directly:

```nginx
server {
    listen 80;
    server_name api.soora.fun;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
```

Then reload nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

Consumet stays internal (port 3000, not exposed). The backend handles all external requests and forwards unknown routes to Consumet via the passthrough handler.

## Cache

Two tiers with different TTLs:
- **Short cache** (10 min, 2000 keys): search results, streams
- **Long cache** (30 min, 5000 keys): info pages, genres, TMDB data

The Stale-While-Revalidate (SWR) pattern returns cached data immediately while refreshing in the background for home bundles.

| Data Type | TTL |
|---|---|
| Home bundles | 15 min (SWR) |
| Anime/Movie info | 30 min |
| Search results | 10 min |
| Genre listings | 15 min |
| Streams | 5 min |
| TMDB data | 30 min |
| Manga chapters | 60 min |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `CONSUMET_URL` | `http://localhost:3000` | Consumet API URL |
| `TMDB_KEY` | (set in .env) | TMDB API key |
| `CORS_ORIGIN` | `https://soora.fun` | Allowed CORS origin |
| `NODE_ENV` | `development` | Environment mode |
