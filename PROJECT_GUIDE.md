# Timeline Dashboard — Project Guide

> **Print to PDF:** Open this file in VS Code or any Markdown viewer → Print → Save as PDF

---

## 1. What This Project Does

A React dashboard for factory production monitoring with:

1. **Login** — secure access with token-based session
2. **Timeline Dashboard** — visual chart + hourly table for one machine, one shift, one date

**Backend:** `https://fractaldmsdev.centralindia.cloudapp.azure.com`  
**Valid data dates:** 22–25 June 2026  
**Timezone:** API uses UTC; UI displays IST (Asia/Kolkata, +05:30)

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 18 + TypeScript + Vite |
| Components | MUI v6 |
| State | Redux Toolkit + RTK Query |
| Routing | React Router v6 |
| Timezone | Luxon |
| Chart | HTML Canvas (custom, high-performance) |

---

## 3. How Shifts Work (IMPORTANT)

### Backend shift format

```json
{
  "name": "summer-shift",
  "shift_timings": ["08:30", "19:00"]
}
```

`shift_timings` is a list of **start times** in IST (not start/end pairs).

Each entry starts a shift that runs until the **next** entry. The last entry wraps to the first.

### Example: `["08:30", "19:00"]`

| Shift | IST Window | Crosses midnight? |
|-------|------------|-------------------|
| summer-shift (08:30 – 19:00) | Same day 08:30 → 19:00 | No |
| summer-shift (19:00 – 08:30 next day) | Same day 19:00 → next day 08:30 | Yes |

### How date + shift combine

When you pick **Date = 23 Jun 2026** and **Shift = 19:00 – 08:30 next day**:

```
IST window:  23 Jun 2026 19:00  →  24 Jun 2026 08:30
UTC sent:    2026-06-23T13:30:00Z  →  2026-06-24T03:00:00Z
```

When you pick **Shift = 08:30 – 19:00**:

```
IST window:  23 Jun 2026 08:30  →  23 Jun 2026 19:00
UTC sent:    2026-06-23T03:00:00Z  →  2026-06-23T13:30:00Z
```

The blue info banner below filters shows the exact query window.

---

## 4. API Endpoints

| # | Endpoint | Purpose |
|---|----------|---------|
| 1 | `POST /auth/login` | Login |
| 2 | `GET /auth/me` | Current user |
| 3 | `POST /auth/logout` | Logout |
| 4 | `GET /core/assets/tree` | Machine/line list |
| 5 | `GET /core/shifts` | Shift definitions |
| 6 | `POST /analytics-query/machine-intervals` | Timeline chart + table data |
| 7 | `POST /analytics-query` | Cycle time metrics |

Every response is wrapped: `{ trace_id, status_code, message, data }`

---

## 5. API #6 — machine-intervals → Chart & Table

### Request
```json
{
  "entity_scope": {
    "type": "asset",
    "asset": { "asset_id": "...", "asset_level_id": 10 }
  },
  "time_range": { "from_ts": "...Z", "to_ts": "...Z" },
  "produce_counts": true,
  "exact_produces": false,
  "group_produce_counts_by_part_model": true
}
```

Set `exact_produces: true` only when "Show individual produces" toggle is ON.

### Response mapping

| API Field | Chart | Hourly Table |
|-----------|-------|--------------|
| `runtimes[]` | Teal/olive bands | Runtime / Unplanned Production minutes |
| `downtimes[]` | Orange bands | Unknown Downtime minutes |
| `stoppages[]` | Purple bands | Stoppage minutes |
| `produce_counts[]` | Coarse PASS/FAIL markers | Total, Pass, Fail |
| `produces[]` | Exact PASS/FAIL markers (toggle ON) | — |

All timestamps converted UTC → IST for display. Data clipped to selected shift window.

---

## 6. API #7 — analytics-query → Cycle Time Rows

### Request
```json
{
  "entity_scope": { ...same as above... },
  "metrics": ["ideal_cycle_time_seconds", "actual_cycle_time_seconds"],
  "time_range": { ...same as above... },
  "distribution": "hourly"
}
```

### Table rows
- **Ideal Cycle Time** ← `ideal_cycle_time_seconds`
- **Actual Cycle Time** ← `actual_cycle_time_seconds`

Matched by `bucket_start` hour (UTC → IST).

---

## 7. Chart Layout

```
┌─────────────────────────────────────────────┐
│  Machine State (segment bands)              │
│  Teal=Runtime  Olive=Unplanned  Orange=DT   │
├─────────────────────────────────────────────┤
│  Production markers (white lane)            │
│  Blue dots = PASS    Red × = FAIL           │
├─────────────────────────────────────────────┤
│  19:00   21:00   23:00   01:00   03:00 ...  │  ← IST axis
└─────────────────────────────────────────────┘
```

**Interactions:**
- **Drag** to zoom into a time range
- **Double-click** or **Reset Zoom** button to reset
- **Hover** markers for timestamp + PASS/FAIL

---

## 8. Hourly Table (9 Rows)

| Row | Source |
|-----|--------|
| Total | ok_count + ng_count per hour |
| Pass | ok_count |
| Fail | ng_count |
| Runtime | planned runtime minutes |
| Unplanned Production | unknown unplanned production minutes |
| Stoppage | stoppage minutes |
| Unknown Downtime | unknown downtime minutes |
| Ideal Cycle Time | analytics-query API |
| Actual Cycle Time | analytics-query API |

Segments spanning multiple hours are split at hour boundaries.

---

## 9. Authentication Flow

```
Login → POST /auth/login → store token in localStorage
      → GET /auth/me → save user → Dashboard

Page refresh → read token → GET /auth/me → stay logged in

401 on any API → clear token → redirect to /login

Logout → POST /auth/logout → clear token → /login
```

---

## 10. Project Structure

```
src/
├── api/client.ts          Token storage helpers
├── store/
│   ├── authSlice.ts       Auth state
│   ├── dashboardFiltersSlice.ts  Filter state
│   └── api/baseApi.ts     RTK Query — all API calls
├── utils/
│   ├── timezone.ts        UTC ↔ IST (Luxon)
│   ├── shiftWindow.ts       Shift parsing + window build
│   ├── chartData.ts         Segment + marker builders
│   ├── hourlyTable.ts       Table bucketing
│   └── produceMarkers.ts    Canvas marker math
├── components/
│   ├── chart/TimelineChart.tsx  Main chart (Canvas)
│   ├── table/HourlySummaryTable.tsx
│   └── filters/FilterBar.tsx
└── pages/
    ├── LoginPage.tsx
    └── DashboardPage.tsx
```

---

## 11. How to Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

**Credentials:** `analytics_user` / `dashboard123`  
**Test date:** 23 June 2026

---

## 12. Troubleshooting

| Problem | Solution |
|---------|----------|
| Wrong shift data | Check blue info banner for exact IST/UTC window |
| Night shift confusing | Select "19:00 – 08:30 **next day**" for evening shift |
| Day shift | Select "08:30 – 19:00" |
| Chart empty | Try date 22–25 Jun 2026, pick AOI machine |
| Login 401 | Contact backend team for valid credentials |
| Zoom not working | Drag (no Shift needed), double-click to reset |

---

## 13. Design Decisions (see NOTES.md)

- **Token:** localStorage (persists on refresh)
- **Chart:** Canvas for 10k–20k markers performance
- **State:** Redux Toolkit + RTK Query
- **FAIL markers:** Never hidden during downsampling

---

*Noviga Timeline Dashboard — Frontend Assignment*
