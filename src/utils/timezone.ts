import { DateTime } from 'luxon'

export const IST_ZONE = 'Asia/Kolkata'

export function utcToIst(isoUtc: string): DateTime {
  return DateTime.fromISO(isoUtc, { zone: 'utc' }).setZone(IST_ZONE)
}

export function istToUtcIso(dt: DateTime): string {
  return dt.setZone(IST_ZONE).toUTC().toISO({ suppressMilliseconds: true }) ?? ''
}

export function formatIstTime(isoUtc: string, format = 'HH:mm:ss'): string {
  return utcToIst(isoUtc).toFormat(format)
}

export function formatIstDateTime(isoUtc: string): string {
  return utcToIst(isoUtc).toFormat('dd LLL, HH:mm:ss')
}

export function nowIst(): DateTime {
  return DateTime.now().setZone(IST_ZONE)
}

export function parseIstDate(dateStr: string, timeStr: string): DateTime {
  return DateTime.fromFormat(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', {
    zone: IST_ZONE,
  })
}

export function msToIstLabel(ms: number, format = 'HH:mm'): string {
  return DateTime.fromMillis(ms, { zone: IST_ZONE }).toFormat(format)
}

export function hourLabel(startMs: number): string {
  const start = DateTime.fromMillis(startMs, { zone: IST_ZONE })
  const end = start.plus({ hours: 1 })
  return `${start.toFormat('HH:mm')}-${end.toFormat('HH:mm')}`
}
