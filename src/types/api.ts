export interface MesEnvelope<T> {
  trace_id: string
  status_code: number
  message: string
  data: T
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface User {
  id: string
  username: string
  name: string
  email: string
  customer_id: string
  customer_name: string
  roles: string[]
  status: string
}

export interface AssetNode {
  id: string
  name: string
  codename: string | null
  assetlevel_id: number
  hierarchy: string | null
  children: AssetNode[]
}

export interface FlatAsset {
  id: string
  name: string
  codename: string | null
  assetlevel_id: number
  label: string
}

export interface Shift {
  id: string
  code: string
  name: string
  shift_timings: string[]
  is_active: boolean
}

export interface ParsedShift {
  id: string
  shiftDefId: string
  shiftIndex: number
  code: string
  name: string
  startTime: string
  endTime: string
  crossesMidnight: boolean
  label: string
}

export interface EntityScope {
  type: 'asset'
  asset: {
    asset_id: string
    asset_level_id: number
  }
}

export interface TimeRange {
  from_ts: string
  to_ts: string
}

export interface RuntimeSegment {
  start_at: string
  end_at: string
  type: string
  runtime_name: string | null
}

export interface DowntimeSegment {
  start_at: string
  end_at: string
  downtime_name: string
  type: string
}

export interface StoppageSegment {
  start_at: string
  end_at: string
  stoppage_name?: string
  type?: string
}

export interface ProduceCount {
  bucket_start: string
  part_model_id: string
  ok_count: number
  ng_count: number
}

export interface ProduceItem {
  produce_id: string
  first_seen_ts: string
  result: 'PASS' | 'FAIL'
  produce_type: string
  part_model_id: string
}

export interface ProduceBucket {
  bucket_start: string
  part_model_id: string
  produces: ProduceItem[]
}

export interface MachineIntervalsResponse {
  machine_ids: number[]
  runtimes: RuntimeSegment[]
  downtimes: DowntimeSegment[]
  stoppages: StoppageSegment[]
  produce_counts: ProduceCount[]
  produces?: ProduceBucket[]
}

export interface CycleTimeBucket {
  entity_id: string
  bucket_start: string
  ideal_cycle_time_seconds: number | null
  actual_cycle_time_seconds: number | null
}

export interface ApiError {
  status: number
  message: string
}

export type SegmentKind =
  | 'runtime'
  | 'unplanned_production'
  | 'unknown_downtime'
  | 'stoppage'

export interface ChartSegment {
  kind: SegmentKind
  startMs: number
  endMs: number
  label: string
}

export interface ProduceMarker {
  timestampMs: number
  result: 'PASS' | 'FAIL'
  produceId?: string
  /** Aggregated count when one dot represents multiple produces (coarse mode) */
  count?: number
  /** Running pass total for positioning the production line */
  cumulativeCount?: number
}

export interface HourlyBucket {
  hourStartMs: number
  label: string
  total: number | null
  pass: number | null
  fail: number | null
  runtime: number | null
  unplannedProduction: number | null
  stoppage: number | null
  unknownDowntime: number | null
  idealCycleTime: number | null
  actualCycleTime: number | null
}

export interface ShiftWindow {
  fromTs: string
  toTs: string
  fromMs: number
  toMs: number
  hourBuckets: { startMs: number; label: string }[]
  istLabel: string
}
