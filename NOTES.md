# Implementation Notes

## How to run

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL if needed
npm run dev
```

- **Backend:** `https://fractaldmsdev.centralindia.cloudapp.azure.com` (no `/api` prefix)
- **Test credentials:** `analytics_user` / `dashboard123`
- **Valid data dates:** 22–25 June 2026

---

## State management — Redux Toolkit + RTK Query

### Client state (Redux slices)

- **`authSlice`** — `token`, `user`, `isAuthenticated`, `isInitializing`
- **`dashboardFiltersSlice`** — selected machine/line, shift, date, "Show individual produces" toggle, zoom range

### Server state (RTK Query)

All API calls go through `baseApi` (`src/store/api/baseApi.ts`) with a shared `baseQueryWithEnvelope` that:

- Unwraps the MES response envelope (`{ trace_id, status_code, message, data }`)
- Attaches `Authorization: Bearer <token>` from Redux state (central client — not repeated per call)
- Retries HTTP **500** twice with exponential backoff (300ms, 900ms)
- Normalizes errors via `src/utils/apiError.ts` so the UI gets plain-language messages
- Dispatches `clearAuth` on **401** for authenticated endpoints (login 401 is handled inline on the login page)

RTK Query handles caching (asset tree and shifts fetched once), deduplication, and automatic refetch when filter args change. Manual refresh invalidates `Intervals` and `CycleTime` tags.

### Why chart geometry is NOT in Redux

20,000 produce markers in Redux would re-render the app on every zoom/hover. Instead:

- Raw API data lives in RTK Query cache
- Marker positions are precomputed into `Float32Array` / `Uint8Array` in `prepareMarkers()` after each fetch
- Canvas redraws use `requestAnimationFrame`, outside React's render path

---

## Session / token management

### Storage: `localStorage`

**Choice:** Token stored in `localStorage` under key `timeline_dashboard_token` (see `src/api/client.ts`).

**Trade-offs considered:**

| Storage | Pros | Cons |
|---------|------|------|
| `localStorage` | Survives page refresh; simple | XSS can read it |
| `sessionStorage` | Cleared on tab close | Lost on refresh in some workflows |
| In-memory | Safest against XSS | User logged out on every refresh |
| HttpOnly cookie | Best XSS protection | Requires backend cookie support (not available here) |

**Decision:** `localStorage` — the assignment requires refresh-on-load session restore, and the backend returns the token in JSON (not Set-Cookie). For production, pair with CSP headers.

### Flow

1. **Login:** `POST /auth/login` → `setToken` → persisted to `localStorage`
2. **App load:** `AuthInitializer` hydrates token → `GET /auth/me` validates → `setUser` or `clearAuth`
3. **API calls:** RTK Query `prepareHeaders` reads token from Redux and sets Bearer header
4. **401 expiry:** Any authenticated 401 → `clearAuth` → redirect to `/login`
5. **Logout:** `POST /auth/logout` → `clearAuth` → redirect to `/login`

---

## Error handling

Implemented in `src/utils/apiError.ts` and wired through `baseApi`, `DashboardPage`, `LoginPage`, and `FilterBar`.

### Behaviour

- **MES envelope errors** (`status_code >= 400` in JSON body) — message extracted from `message` field
- **HTTP errors** (404, 403, 500, etc.) — body parsed and normalized before reaching UI
- **Network / timeout** — friendly fallback messages
- **UI copy** — no HTTP status codes shown to end users; technical API strings like "Not Found" are mapped to plain language

### Examples shown to users

| Situation | Message |
|-----------|---------|
| 404 / not found | We could not find data for this selection. Try another date, machine, or shift. |
| 401 (login) | Incorrect username or password. Please try again. |
| 401 (session) | Your session has expired. Please sign in again. |
| 403 | You do not have permission to view this data. |
| 500 (after retries) | Something went wrong on our side. Please try again in a moment. |
| Network failure | Unable to reach the server. Please check your internet connection and try again. |

Dashboard errors include a **Retry** button that refetches intervals and cycle-time data.

---

## Chart performance

### Approach: single Canvas chart

| Layer | Technology | Why |
|-------|-----------|-----|
| Segment bands | Canvas rectangles in `TimelineChart` | ~dozens of segments; drawn on same canvas as markers |
| Produce markers | Canvas dots / line | 10k–20k points — SVG would create 20k DOM nodes |

Chart height is **260px** for the main lane (segments + production overlay) plus axis.

### Two chart modes (driven by "Show individual produces" toggle)

**Toggle OFF — hourly summary (`clusterMode = true`)**

- API: `exact_produces: false`, uses `produce_counts`
- `buildCoarseMarkers()` aggregates `produce_counts` **by hour**, summing across all `part_model_id` rows
- **One dot per shift hour** at hour midpoint
- Blue cumulative production line; dot **labels show hourly pass count** (matches table)
- Dot **height** follows cumulative pass (line slopes up over the shift)
- White dots with blue stroke; count label beside each dot

**Toggle ON — individual produces (`clusterMode = false`)**

- API: `exact_produces: true`, uses flattened `produces[]` (`buildExactMarkers()`)
- One marker per part at real `first_seen_ts` (list is **not sorted** from API — sorted client-side)
- Blue dot = **PASS**, red circle with **×** = **FAIL**
- `selectMarkersForDraw()` downsamples when zoomed out (pixel-bin strategy)
- Legend shows total marker count (e.g. `434 markers · exact produces`)

### Optimizations (individual mode)

1. **Precompute once** — `prepareMarkers()` builds typed arrays after fetch, not during render
2. **Viewport culling + pixel-bin downsampling** — when zoomed out, markers binned by pixel column; max 1–2 PASS per column, **all FAIL markers in a column always drawn**
3. **Zoomed-in fast path** — when `msPerPixel < 3000`, draw all visible markers (cap 5000)
4. **`requestAnimationFrame`** — canvas redraw on zoom/resize/brush
5. **`React.memo`** on chart components
6. **Hover** — `findNearestProductionPoint()` uses pixel distance; binary search available via `findNearestMarker()`

### FAIL preservation rule

When downsampling, **never drop a FAIL** to improve performance. Only PASS markers are thinned.

### Verification

Test with toggle ON on 22–25 June 2026 (10k–20k rows). Brush-zoom and hover should stay responsive without multi-second freezes.

---

## Time handling — UTC ↔ IST

### Library: Luxon with `Asia/Kolkata` zone

All API timestamps are UTC (`Z`). All UI display is IST (+05:30).

### Outbound (UI → API)

1. User selects date + shift in IST
2. `buildShiftWindow()` (`src/utils/shiftWindow.ts`) builds window from dynamic `shift_timings`
3. Overnight shifts (end ≤ start) roll end to next day; labels show **"next day"** where needed
4. Convert to UTC ISO via `.toUTC().toISO()` for `time_range`
5. Filter bar shows IST query window + UTC API range for debugging

### Inbound (API → UI)

Every `start_at`, `end_at`, `bucket_start`, `first_seen_ts` converted UTC → IST before display or bucketing.

### Hourly table bucketing (`src/utils/hourlyTable.ts`)

One column per clock hour overlapping the shift:

1. Segments clipped at hour boundaries; minutes accumulated per kind
2. Produce rows from `produce_counts` (summed across part models)
3. Cycle time from separate `POST /analytics-query` with `distribution: "hourly"`
4. **In-progress shift:** future hour columns blank (`null`), not zero-filled

---

## Assumptions

1. **Asset selector:** Flattened asset tree with indentation; default = first machine-level node (`assetlevel_id: 10`), else first line-level node
2. **Shift parsing:** Parsed dynamically from backend `shift_timings`; no hard-coded A/B/C shifts
3. **Toggle off chart:** Hourly overview with pass count labels — not individual PASS/FAIL dots (FAIL counts still in table)
4. **Toggle on chart:** Full assignment behaviour — individual markers with performance downsampling
5. **Segment overlap:** Backend returns tiled non-overlapping segments; no client-side gap filling
6. **Cumulative line (toggle off):** Y-position uses running pass total; labels use per-hour pass count — intentional for overview readability

---

## Out of scope (not built)

Per assignment: CSV/PDF export, auto-refresh polling, segment classification dialogs, i18n, multi-theme, settings page, multi-machine dashboard views.

---

## Core requirements checklist

| Requirement | Status |
|-------------|--------|
| Auth: login, session restore, protected routes, logout, 401 handling | Done |
| Filter bar: machine, shift, date, toggle, refresh | Done |
| API: machine-intervals + cycle-time, UTC conversion, MES unwrap | Done |
| Chart: segment bands, zoom, hover, toggle off/on modes | Done |
| Chart: 10k–20k marker performance (toggle on) | Done |
| Hourly table: all 9 rows | Done |
| Loading, error (+ retry), empty, in-progress states | Done |
| User-friendly error messages | Done |
| NOTES.md + README + .env.example | Done |
| Git repository | Initialized locally |
