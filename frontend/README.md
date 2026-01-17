# Jaw-Clench Communication Interface - Frontend

A React-based communication interface for jaw-clench input.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Keyboard Controls (Dev Mode)

| Key | Action |
|-----|--------|
| `1` or `→` | Move cursor right |
| `2` or `↓` | Move cursor down |
| `3` | Refresh word grid |
| Wait 800ms | Auto-select word |

## Production Build

```bash
npm run build
npm run preview
```

## Docker Deployment

### Build & Run

```bash
docker build -t jaw-clench-frontend .
docker run -p 8080:80 jaw-clench-frontend
```

Open http://localhost:8080

### Docker Compose

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

## Cloud Deployment

### Vercel / Netlify

1. Connect your repository
2. Set build command: `npm run build`
3. Set output directory: `dist`

### Manual Server

1. Build: `npm run build`
2. Copy `dist/` contents to your web server
3. Configure server for SPA routing (redirect all routes to `index.html`)

## Tech Stack

- Vite + React 18 + TypeScript
- Zustand (state management)
- Framer Motion (animations)
- CSS Modules
