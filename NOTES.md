# Implementation Notes

## State management — Redux Toolkit + RTK Query

### Client state (Redux slices)

- **`authSlice`** — `token`, `user`, `isAuthenticated`, `isInitializing`
- **`dashboardFiltersSlice`** — selected machine/line, shift, date, "Show individual produces" toggle, zoom range

### Server state (RTK Query)

All API calls go through `baseApi` with a shared `baseQueryWithEnvelope` that:
- Unwraps the MES response envelope (`{ trace_id, status_code, message, data }`)
- Attaches `Authorization: Bearer <token>` from Redux state
- Retries HTTP 500 responses twice with exponential backoff (300ms, 900ms)
- Dispatches `clearAuth` on 401 for authenticated endpoints

RTK Query handles caching (assets tree and shifts fetched once), deduplication, and automatic refetch when filter args change.

### Why chart geometry is NOT in Redux

20,000 produce markers stored in Redux would trigger re-renders across the app on every zoom/hover. Instead:
- Raw API data lives in RTK Query cache
- Marker positions are precomputed into `Float32Array` inside `prepareMarkers()` after each fetch
- Canvas redraws bypass React's render cycle via `requestAnimationFrame`

---

## Session / token management

### Storage: `localStorage`

**Choice:** Token stored in `localStorage` under key `timeline_dashboard_token`.

**Trade-offs considered:**

| Storage | Pros | Cons |
|---------|------|------|
| `localStorage` | Survives page refresh; simple | XSS can read it |
| `sessionStorage` | Cleared on tab close | Lost on refresh in some workflows |
| In-memory | Safest against XSS | User logged out on every refresh |
| HttpOnly cookie | Best XSS protection | Requires backend cookie support (not available here) |

**Decision:** `localStorage` — the assignment requires refresh-on-load session restore, and the backend returns the token in JSON (not Set-Cookie). XSS risk is acceptable for this SPA assignment with the understanding that production apps should also use CSP headers.

### Flow

1. **Login:** `POST /auth/login` → `setToken` action → persisted to `localStorage`
2. **App load:** `getStoredToken()` hydrates Redux → `useGetMeQuery` validates → `setUser` or `clearAuth`
3. **API calls:** RTK Query `prepareHeaders` reads token from Redux and sets Bearer header
4. **401 expiry:** Any authenticated 401 → `clearAuth` → redirect to `/login`
5. **Logout:** `POST /auth/logout` → `clearAuth` → redirect to `/login`

---

## Chart performance

### Approach: Canvas + precomputed geometry

| Layer | Technology | Why |
|-------|-----------|-----|
| Segment bands | Canvas rectangles in `TimelineChart` | Same canvas as markers; dozens of segments |
| Produce markers | HTML `<canvas>` | 10k–20k points — SVG would create 20k DOM nodes |

### Two chart modes (driven by toggle)

**Toggle OFF — hourly summary line (`clusterMode`)**
- Markers from `produce_counts` aggregated by hour (summed across part models)
- One dot per shift hour at hour midpoint
- Blue cumulative production line with hourly pass count labels
- Data source: `produce_counts` (no `exact_produces` in API request)

**Toggle ON — individual produces (`exact` mode)**
- Markers from flattened `produces[]` using each row's `first_seen_ts`
- One marker per part (`buildExactMarkers()`)
- Blue dots = PASS, red × = FAIL
- API called with `exact_produces: true` (10k–20k rows)
- Rendering uses `selectMarkersForDraw()` with pixel-bin downsampling when zoomed out

### Optimizations (individual mode)

1. **Precompute once** — `prepareMarkers()` converts timestamps to `Float32Array` and `Uint8Array` pass/fail flags after fetch, not during render
2. **Viewport culling + pixel-bin downsampling** — `selectMarkersForDraw()` bins markers by pixel column when zoomed out; at most 1–2 PASS markers per column, but **all FAIL markers in that column are always drawn**
3. **`requestAnimationFrame`** — canvas redraw scheduled on zoom/resize, not synchronous in React render
4. **`React.memo`** — chart subcomponents skip re-render when props unchanged
5. **Binary search hover** — `findNearestMarker()` uses sorted x-array for O(log n) lookup in exact mode

### FAIL preservation rule

When zoomed out and multiple markers map to the same pixel column:
- All FAIL markers in that column are rendered
- Only one (or two) PASS marker(s) are shown per column

This ensures defects are never hidden for performance.

### Verification

Test with "Show individual produces" ON on 22–25 June 2026 data (10k–20k rows). Zoom brush and hover should remain responsive with no multi-second freezes. Legend shows marker count (e.g. "434 markers · exact produces").

---

## Time handling — UTC ↔ IST

### Library: Luxon with `Asia/Kolkata` zone

All API timestamps are UTC (`Z` suffix). All UI display is IST (+05:30).

### Outbound (UI → API)

1. User selects date + shift start/end in IST
2. `buildShiftWindow()` constructs Luxon `DateTime` in `Asia/Kolkata`
3. If shift end ≤ start, end date rolls to next day (midnight crossing)
4. Convert to UTC ISO via `.toUTC().toISO()` for `time_range`

### Inbound (API → UI)

1. Every `start_at`, `end_at`, `bucket_start`, `first_seen_ts` parsed with `DateTime.fromISO(iso, { zone: 'utc' }).setZone('Asia/Kolkata')`
2. Chart axis ticks, tooltips, and table hour columns all use IST

### Hourly bucketing

Clock-aligned hour columns (e.g., 08:00–09:00) that overlap the shift window:
1. Segments converted to IST milliseconds
2. For each hour column, clip segment at hour boundaries
3. Accumulate fractional minutes per segment kind (runtime, unplanned production, stoppage, unknown downtime)
4. Produce counts matched by `bucket_start` hour
5. Cycle time matched by `bucket_start` hour from separate analytics-query call
6. In-progress shifts: columns after current IST time left blank (null), not zero-filled

---

## Assumptions

1. **Asset selector:** Flattened asset tree with indentation; default selection is first machine-level node (`assetlevel_id: 10`), falling back to line level
2. **Shift parsing:** Dynamic from backend `shift_timings`; no hard-coded A/B/C shifts
3. **Toggle off chart:** Hourly pass line with count labels (not individual PASS/FAIL dots) — clearer overview aligned with reference mockups
4. **Segment overlap:** Backend returns tiled non-overlapping segments; no client-side gap filling needed

## Scope cuts

Not implemented (out of scope per assignment):
- CSV/PDF export, auto-refresh polling, segment classification dialogs, i18n, multi-theme

Known gaps:
- **422 field-level validation errors** — generic error message only
- **Deployed link** — add after Vercel/Netlify deployment
- **In-progress current hour** — future hours blank; partial current hour may include full-hour segment minutes

Core requirements implemented:
- Auth with session restore
- Filter bar with all controls
- Timeline chart: segments, hourly line (toggle off), individual markers (toggle on), zoom, hover
- Hourly summary table with all 9 rows
- Loading, error, empty, in-progress states
