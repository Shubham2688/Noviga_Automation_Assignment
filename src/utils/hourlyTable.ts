import type {
  CycleTimeBucket,
  HourlyBucket,
  MachineIntervalsResponse,
  ShiftWindow,
} from '../types/api'
import { nowIst, utcToIst } from './timezone'
import {
  bucketProduceCounts,
  bucketSegmentMinutes,
  segmentsFromIntervals,
} from './chartData'

export function buildHourlyTable(
  intervals: MachineIntervalsResponse,
  cycleTime: CycleTimeBucket[],
  shiftWindow: ShiftWindow,
): HourlyBucket[] {
  const segments = segmentsFromIntervals(intervals, shiftWindow.fromMs, shiftWindow.toMs)
  const nowMs = nowIst().toMillis()
  const isInProgress = shiftWindow.toMs > nowMs

  const cycleMap = new Map<number, CycleTimeBucket>()
  for (const bucket of cycleTime) {
    const hourStartMs = utcToIst(bucket.bucket_start).startOf('hour').toMillis()
    cycleMap.set(hourStartMs, bucket)
  }

  return shiftWindow.hourBuckets.map((hour) => {
    const hourEndMs = hour.startMs + 3600000

    if (isInProgress && hour.startMs >= nowMs) {
      return emptyHour(hour.startMs, hour.label)
    }

    const effectiveEnd = isInProgress ? Math.min(hourEndMs, nowMs) : hourEndMs
    if (isInProgress && hour.startMs >= effectiveEnd) {
      return emptyHour(hour.startMs, hour.label)
    }

    const { pass, fail } = bucketProduceCounts(
      intervals.produce_counts,
      hour.startMs,
      hourEndMs,
    )

    const cycle = cycleMap.get(hour.startMs)

    return {
      hourStartMs: hour.startMs,
      label: hour.label,
      total: pass + fail,
      pass,
      fail,
      runtime: bucketSegmentMinutes(segments, hour.startMs, hourEndMs, 'runtime'),
      unplannedProduction: bucketSegmentMinutes(
        segments,
        hour.startMs,
        hourEndMs,
        'unplanned_production',
      ),
      stoppage: bucketSegmentMinutes(segments, hour.startMs, hourEndMs, 'stoppage'),
      unknownDowntime: bucketSegmentMinutes(
        segments,
        hour.startMs,
        hourEndMs,
        'unknown_downtime',
      ),
      idealCycleTime: cycle?.ideal_cycle_time_seconds ?? null,
      actualCycleTime: cycle?.actual_cycle_time_seconds ?? null,
    }
  })
}

function emptyHour(startMs: number, label: string): HourlyBucket {
  return {
    hourStartMs: startMs,
    label,
    total: null,
    pass: null,
    fail: null,
    runtime: null,
    unplannedProduction: null,
    stoppage: null,
    unknownDowntime: null,
    idealCycleTime: null,
    actualCycleTime: null,
  }
}
