import type {
  ChartSegment,
  MachineIntervalsResponse,
  ProduceCount,
  ProduceItem,
  ProduceMarker,
  SegmentKind,
} from '../types/api'
import { utcToIst } from './timezone'
import { SEGMENT_COLORS, SEGMENT_LABELS, MARKER_COLORS } from './chartLayout'

export { SEGMENT_COLORS, SEGMENT_LABELS, MARKER_COLORS }

export function classifyRuntime(type: string): SegmentKind {
  if (type === 'unknown unplanned production') return 'unplanned_production'
  return 'runtime'
}

export function classifyDowntime(_type: string): SegmentKind {
  return 'unknown_downtime'
}

export function buildChartSegments(
  data: MachineIntervalsResponse,
  windowFromMs?: number,
  windowToMs?: number,
): ChartSegment[] {
  const segments: ChartSegment[] = []

  for (const r of data.runtimes) {
    const startMs = utcToIst(r.start_at).toMillis()
    const endMs = utcToIst(r.end_at).toMillis()
    if (windowFromMs !== undefined && windowToMs !== undefined) {
      if (endMs < windowFromMs || startMs > windowToMs) continue
    }
    segments.push({
      kind: classifyRuntime(r.type),
      startMs: Math.max(startMs, windowFromMs ?? startMs),
      endMs: Math.min(endMs, windowToMs ?? endMs),
      label: r.type === 'planned' ? 'Runtime' : r.type,
    })
  }

  for (const d of data.downtimes) {
    const startMs = utcToIst(d.start_at).toMillis()
    const endMs = utcToIst(d.end_at).toMillis()
    if (windowFromMs !== undefined && windowToMs !== undefined) {
      if (endMs < windowFromMs || startMs > windowToMs) continue
    }
    segments.push({
      kind: classifyDowntime(d.type),
      startMs: Math.max(startMs, windowFromMs ?? startMs),
      endMs: Math.min(endMs, windowToMs ?? endMs),
      label: d.downtime_name ?? 'Unknown',
    })
  }

  for (const s of data.stoppages) {
    const startMs = utcToIst(s.start_at).toMillis()
    const endMs = utcToIst(s.end_at).toMillis()
    if (windowFromMs !== undefined && windowToMs !== undefined) {
      if (endMs < windowFromMs || startMs > windowToMs) continue
    }
    segments.push({
      kind: 'stoppage',
      startMs: Math.max(startMs, windowFromMs ?? startMs),
      endMs: Math.min(endMs, windowToMs ?? endMs),
      label: s.stoppage_name ?? 'Stoppage',
    })
  }

  return segments.sort((a, b) => a.startMs - b.startMs)
}

export function flattenProduces(data: MachineIntervalsResponse): ProduceItem[] {
  if (!data.produces) return []
  const items: ProduceItem[] = []
  for (const bucket of data.produces) {
    items.push(...bucket.produces)
  }
  return items
}


function aggregateProduceCountsByHour(
  data: MachineIntervalsResponse,
): Map<number, { pass: number; fail: number }> {
  const byHour = new Map<number, { pass: number; fail: number }>()
  for (const bucket of data.produce_counts) {
    const hourStart = utcToIst(bucket.bucket_start).startOf('hour').toMillis()
    const existing = byHour.get(hourStart) ?? { pass: 0, fail: 0 }
    existing.pass += bucket.ok_count
    existing.fail += bucket.ng_count
    byHour.set(hourStart, existing)
  }
  return byHour
}

function buildHourlyPassMarkers(
  byHour: Map<number, { pass: number; fail: number }>,
  hourBuckets?: { startMs: number; label: string }[],
): ProduceMarker[] {
  const hours =
    hourBuckets?.map((h) => h.startMs) ?? [...byHour.keys()].sort((a, b) => a - b)

  let cumulativePass = 0
  const markers: ProduceMarker[] = []

  for (const hourStart of hours) {
    const { pass } = byHour.get(hourStart) ?? { pass: 0, fail: 0 }
    cumulativePass += pass
    markers.push({
      timestampMs: hourStart + 1_800_000,
      result: 'PASS',
      count: pass,
      cumulativeCount: cumulativePass,
    })
  }

  return markers
}

function aggregateExactProducesByHour(
  data: MachineIntervalsResponse,
  windowFromMs?: number,
  windowToMs?: number,
): Map<number, { pass: number; fail: number }> {
  const byHour = new Map<number, { pass: number; fail: number }>()
  for (const item of flattenProduces(data)) {
    const timestampMs = utcToIst(item.first_seen_ts).toMillis()
    if (windowFromMs !== undefined && windowToMs !== undefined) {
      if (timestampMs < windowFromMs || timestampMs > windowToMs) continue
    }
    const hourStart = utcToIst(item.first_seen_ts).startOf('hour').toMillis()
    const existing = byHour.get(hourStart) ?? { pass: 0, fail: 0 }
    if (item.result === 'PASS') existing.pass += 1
    else existing.fail += 1
    byHour.set(hourStart, existing)
  }
  return byHour
}

/** One dot per hour — pass count from produce_counts API buckets */
export function buildCoarseMarkers(
  data: MachineIntervalsResponse,
  hourBuckets?: { startMs: number; label: string }[],
): ProduceMarker[] {
  return buildHourlyPassMarkers(aggregateProduceCountsByHour(data), hourBuckets)
}

/** One dot per hour — pass count aggregated from exact produces[] records */
export function buildExactHourlyMarkers(
  data: MachineIntervalsResponse,
  hourBuckets?: { startMs: number; label: string }[],
  windowFromMs?: number,
  windowToMs?: number,
): ProduceMarker[] {
  return buildHourlyPassMarkers(
    aggregateExactProducesByHour(data, windowFromMs, windowToMs),
    hourBuckets,
  )
}

export function totalMarkerProduces(markers: ProduceMarker[]): number {
  return markers.reduce((sum, m) => sum + (m.count ?? 1), 0)
}

export function buildExactMarkers(
  data: MachineIntervalsResponse,
  windowFromMs?: number,
  windowToMs?: number,
): ProduceMarker[] {
  const items = flattenProduces(data)
  return items
    .map((p) => ({
      timestampMs: utcToIst(p.first_seen_ts).toMillis(),
      result: p.result,
      produceId: p.produce_id,
    }))
    .filter((m) => {
      if (windowFromMs === undefined || windowToMs === undefined) return true
      return m.timestampMs >= windowFromMs && m.timestampMs <= windowToMs
    })
    .sort((a, b) => a.timestampMs - b.timestampMs)
}

interface SegmentInput {
  startMs: number
  endMs: number
  kind: SegmentKind
}

export function bucketSegmentMinutes(
  segments: SegmentInput[],
  hourStartMs: number,
  hourEndMs: number,
  kind: SegmentKind,
): number {
  let total = 0
  for (const seg of segments) {
    if (seg.kind !== kind) continue
    const start = Math.max(seg.startMs, hourStartMs)
    const end = Math.min(seg.endMs, hourEndMs)
    if (end > start) total += (end - start) / 60000
  }
  return Math.round(total * 10) / 10
}

export function bucketProduceCounts(
  produceCounts: ProduceCount[],
  hourStartMs: number,
  hourEndMs: number,
): { pass: number; fail: number } {
  let pass = 0
  let fail = 0
  for (const bucket of produceCounts) {
    const bucketHourStart = utcToIst(bucket.bucket_start).startOf('hour').toMillis()
    if (bucketHourStart >= hourStartMs && bucketHourStart < hourEndMs) {
      pass += bucket.ok_count
      fail += bucket.ng_count
    }
  }
  return { pass, fail }
}

export function segmentsFromIntervals(
  data: MachineIntervalsResponse,
  windowFromMs?: number,
  windowToMs?: number,
): SegmentInput[] {
  const chartSegs = buildChartSegments(data, windowFromMs, windowToMs)
  return chartSegs.map((s) => ({
    startMs: s.startMs,
    endMs: s.endMs,
    kind: s.kind,
  }))
}
