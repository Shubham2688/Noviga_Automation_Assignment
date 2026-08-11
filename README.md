# Timeline Dashboard

React 18 + TypeScript dashboard for machine production timeline analytics, with authentication and an interactive high-performance chart.

## Prerequisites

- Node.js 18+ and npm

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Environment

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend base URL (no `/api` prefix) |

Default: `https://fractaldmsdev.centralindia.cloudapp.azure.com`

## Test credentials

- **Username:** `analytics_user`
- **Password:** `dashboard123`
- **Valid dates:** 22–25 June 2026

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Deployment

Deploy to Vercel or Netlify. Set `VITE_API_BASE_URL` as an environment variable.

```bash
npm run build
```

## Architecture

- **Redux Toolkit** — client state (auth, filters)
- **RTK Query** — server state (API calls, caching, retries)
- **MUI v6** — UI components
- **Luxon** — UTC ↔ IST timezone handling
- **Canvas** — high-performance produce marker rendering (10k–20k points)

See [NOTES.md](./NOTES.md) for detailed design decisions.

## Documentation

| File | Description |
|------|-------------|
| [docs/Production-Timeline-User-Guide.pdf](./docs/Production-Timeline-User-Guide.pdf) | **Client user guide (PDF)** — how to use the app (shareable) |
| [docs/Timeline-Dashboard-Project-Guide.pdf](./docs/Timeline-Dashboard-Project-Guide.pdf) | Technical project guide (PDF) — architecture, shifts, APIs |
| [docs/client-user-guide.html](./docs/client-user-guide.html) | Client guide HTML source |
| [docs/project-guide.html](./docs/project-guide.html) | Technical guide HTML source |
| [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) | Markdown technical reference |

Regenerate PDFs (requires Chrome): `npm run generate-pdf:client` or `npm run generate-pdf`
