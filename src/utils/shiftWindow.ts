import { DateTime } from 'luxon'
import type { ParsedShift, Shift } from '../types/api'
import { parseIstDate, istToUtcIso, hourLabel, utcToIst } from './timezone'
import type { ShiftWindow } from '../types/api'

/** Normalize "7:00", "07:00:00", "19:00" → "07:00" / "19:00" */
export function normalizeShiftTime(time: string): string {
  const trimmed = time.trim()
  const parts = trimmed.split(':')
  const h = parts[0]?.padStart(2, '0') ?? '00'
  const m = (parts[1] ?? '00').padStart(2, '0')
  return `${h}:${m}`
}

function timeToMinutes(time: string): number {
  const [h, m] = normalizeShiftTime(time).split(':').map(Number)
  return h * 60 + m
}

export function parseShifts(shifts: Shift[]): ParsedShift[] {
  const result: ParsedShift[] = []

  for (const shift of shifts) {
    if (!shift.is_active || shift.shift_timings.length === 0) continue

    const timings = shift.shift_timings.map(normalizeShiftTime)
    for (let i = 0; i < timings.length; i++) {
      const startTime = timings[i]
      const endTime = timings[(i + 1) % timings.length]
      const crossesMidnight = timeToMinutes(endTime) <= timeToMinutes(startTime)

      result.push({
        id: `${shift.id}-${i}`,
        shiftDefId: shift.id,
        shiftIndex: i,
        code: shift.code,
        name: shift.name,
        startTime,
        endTime,
        crossesMidnight,
        label: formatShiftLabel(shift.name, startTime, endTime, crossesMidnight),
      })
    }
  }

  return result.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
}

function formatShiftLabel(
  name: string,
  start: string,
  end: string,
  crossesMidnight: boolean,
): string {
  if (crossesMidnight) {
    return `${name} (${start} – ${end} next day)`
  }
  return `${name} (${start} – ${end})`
}

export function buildShiftWindow(dateStr: string, shift: ParsedShift): ShiftWindow {
  const start = parseIstDate(dateStr, shift.startTime)
  let end = parseIstDate(dateStr, shift.endTime)

  if (shift.crossesMidnight || end <= start) {
    end = end.plus({ days: 1 })
  }

  const fromTs = istToUtcIso(start)
  const toTs = istToUtcIso(end)
  const fromMs = start.toMillis()
  const toMs = end.toMillis()

  const hourBuckets: { startMs: number; label: string }[] = []
  let hourStart = start.startOf('hour')

  while (hourStart < end) {
    const hourEnd = hourStart.plus({ hours: 1 })
    if (hourEnd > start && hourStart < end) {
      hourBuckets.push({
        startMs: hourStart.toMillis(),
        label: hourLabel(hourStart.toMillis()),
      })
    }
    hourStart = hourStart.plus({ hours: 1 })
  }

  if (hourBuckets.length === 0) {
    hourBuckets.push({ startMs: fromMs, label: hourLabel(fromMs) })
  }

  return {
    fromTs,
    toTs,
    fromMs,
    toMs,
    hourBuckets,
    istLabel: formatWindowIstLabel(start, end),
  }
}

export function formatWindowIstLabel(start: DateTime, end: DateTime): string {
  const sameDay = start.toFormat('yyyy-MM-dd') === end.toFormat('yyyy-MM-dd')
  if (sameDay) {
    return `${start.toFormat('dd MMM yyyy')}, ${start.toFormat('HH:mm')} – ${end.toFormat('HH:mm')} IST`
  }
  return `${start.toFormat('dd MMM HH:mm')} – ${end.toFormat('dd MMM HH:mm')} IST`
}

export function formatUtcWindow(fromTs: string, toTs: string): string {
  const start = utcToIst(fromTs)
  const end = utcToIst(toTs)
  return `${start.toFormat('dd MMM HH:mm')} – ${end.toFormat('dd MMM HH:mm')} IST`
}

export function isTimestampInWindow(ms: number, fromMs: number, toMs: number): boolean {
  return ms >= fromMs && ms <= toMs
}

export function flattenAssetTree(
  nodes: import('../types/api').AssetNode[],
  depth = 0,
): import('../types/api').FlatAsset[] {
  const result: import('../types/api').FlatAsset[] = []

  for (const node of nodes) {
    const prefix = depth > 0 ? '— '.repeat(depth) : ''
    const displayName = node.codename ?? node.name
    result.push({
      id: node.id,
      name: node.name,
      codename: node.codename,
      assetlevel_id: node.assetlevel_id,
      label: `${prefix}${displayName}`,
    })
    if (node.children.length > 0) {
      result.push(...flattenAssetTree(node.children, depth + 1))
    }
  }

  return result
}

export function pickDefaultAsset(
  assets: import('../types/api').FlatAsset[],
): import('../types/api').FlatAsset | null {
  const machine = assets.find((a) => a.assetlevel_id === 10)
  if (machine) return machine
  const line = assets.find((a) => a.assetlevel_id === 20)
  if (line) return line
  return assets[assets.length - 1] ?? null
}

export function pickDefaultShift(shifts: ParsedShift[]): ParsedShift | null {
  const dayShift = shifts.find((s) => !s.crossesMidnight)
  return dayShift ?? shifts[0] ?? null
}
