import type { ProduceMarker } from '../types/api'
import { MARKER_COLORS } from './chartLayout'

export interface PreparedMarkers {
  xs: Float32Array
  isFail: Uint8Array
  markers: ProduceMarker[]
  count: number
}

export function prepareMarkers(markers: ProduceMarker[]): PreparedMarkers {
  const count = markers.length
  const xs = new Float32Array(count)
  const isFail = new Uint8Array(count)

  for (let i = 0; i < count; i++) {
    xs[i] = markers[i].timestampMs
    isFail[i] = markers[i].result === 'FAIL' ? 1 : 0
  }

  return { xs, isFail, markers, count }
}

export function msToX(
  ms: number,
  viewStartMs: number,
  viewEndMs: number,
  width: number,
  paddingLeft = 0,
): number {
  const innerWidth = width
  return paddingLeft + ((ms - viewStartMs) / (viewEndMs - viewStartMs)) * innerWidth
}

export function xToMs(
  x: number,
  viewStartMs: number,
  viewEndMs: number,
  width: number,
  paddingLeft = 0,
): number {
  const ratio = (x - paddingLeft) / width
  return viewStartMs + ratio * (viewEndMs - viewStartMs)
}

export interface DrawMarker {
  timestampMs: number
  isFail: boolean
  count: number
  cumulativeCount?: number
  markerIndex: number
}

/** Pick markers to draw — one clean dot per pixel column in cluster mode */
export function selectMarkersForDraw(
  prepared: PreparedMarkers,
  viewStartMs: number,
  viewEndMs: number,
  chartWidth: number,
  clusterMode = false,
): DrawMarker[] {
  const { xs, isFail, markers, count } = prepared
  const result: DrawMarker[] = []

  if (count === 0 || chartWidth <= 0) {
    return result
  }

  const viewSpan = viewEndMs - viewStartMs
  const msPerPixel = viewSpan / chartWidth
  const pixels = Math.max(1, Math.floor(chartWidth))

  if (clusterMode) {
    for (let i = 0; i < count; i++) {
      if (xs[i] < viewStartMs || xs[i] > viewEndMs) continue
      result.push({
        timestampMs: xs[i],
        isFail: isFail[i] === 1,
        count: markers[i].count ?? 1,
        cumulativeCount: markers[i].cumulativeCount,
        markerIndex: i,
      })
    }
    return result
  }

  // Zoomed in enough — draw every visible marker (up to 5000 for perf)
  if (msPerPixel < 3000) {
    for (let i = 0; i < count; i++) {
      if (xs[i] >= viewStartMs && xs[i] <= viewEndMs) {
        result.push({
          timestampMs: xs[i],
          isFail: isFail[i] === 1,
          count: markers[i].count ?? 1,
          markerIndex: i,
        })
        if (result.length >= 5000) break
      }
    }
    return result
  }

  // Medium zoom — bin by pixel, keep all FAILs, up to 2 PASS per bin
  const bins: { pass: number[]; fail: number[] }[] = Array.from({ length: pixels }, () => ({
    pass: [],
    fail: [],
  }))

  for (let i = 0; i < count; i++) {
    const t = xs[i]
    if (t < viewStartMs || t > viewEndMs) continue
    const ratio = (t - viewStartMs) / viewSpan
    const px = Math.min(pixels - 1, Math.max(0, Math.floor(ratio * pixels)))
    if (isFail[i]) bins[px].fail.push(i)
    else bins[px].pass.push(i)
  }

  const maxPassPerBin = msPerPixel < 15000 ? 2 : 1

  for (let px = 0; px < pixels; px++) {
    for (const idx of bins[px].fail) {
      result.push({
        timestampMs: xs[idx],
        isFail: true,
        count: 1,
        markerIndex: idx,
      })
    }
    const passSlice = bins[px].pass.slice(0, maxPassPerBin)
    for (const idx of passSlice) {
      result.push({
        timestampMs: xs[idx],
        isFail: false,
        count: 1,
        markerIndex: idx,
      })
    }
  }

  return result
}

export function findNearestProductionPoint(
  drawMarkers: DrawMarker[],
  prepared: PreparedMarkers,
  mouseX: number,
  mouseY: number,
  viewStartMs: number,
  viewEndMs: number,
  chartWidth: number,
  segH: number,
  clusterMode: boolean,
  hitRadiusPx = 14,
): { timestampMs: number; result: 'PASS' | 'FAIL'; count: number; produceId?: string } | null {
  if (drawMarkers.length === 0 || chartWidth <= 0) return null

  const visible = drawMarkers
    .filter((dm) => !dm.isFail)
    .sort((a, b) => a.timestampMs - b.timestampMs)
  const maxCumulative = Math.max(
    ...visible.map((dm) => dm.cumulativeCount ?? dm.count),
    1,
  )

  let best: DrawMarker | null = null
  let bestDist = hitRadiusPx

  for (const dm of drawMarkers) {
    const x = msToX(dm.timestampMs, viewStartMs, viewEndMs, chartWidth)
    const y = clusterMode
      ? cumulativeY(
          dm.cumulativeCount ?? dm.count,
          maxCumulative,
          segH,
          36,
          24,
        )
      : segH / 2 + 6
    const dist = Math.hypot(x - mouseX, y - mouseY)
    if (dist <= bestDist) {
      bestDist = dist
      best = dm
    }
  }

  if (!best) return null
  const source = prepared.markers[best.markerIndex]
  return {
    timestampMs: best.timestampMs,
    result: best.isFail ? 'FAIL' : 'PASS',
    count: best.count,
    produceId: source?.produceId,
  }
}

export function findNearestMarker(
  prepared: PreparedMarkers,
  targetMs: number,
  thresholdMs: number,
): ProduceMarker | null {
  const { xs, markers, count } = prepared
  if (count === 0) return null

  let lo = 0
  let hi = count - 1

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (xs[mid] < targetMs) lo = mid + 1
    else hi = mid
  }

  let best: ProduceMarker | null = null
  let bestDist = thresholdMs

  for (const idx of [lo - 2, lo - 1, lo, lo + 1, lo + 2]) {
    if (idx < 0 || idx >= count) continue
    const dist = Math.abs(xs[idx] - targetMs)
    if (dist <= bestDist) {
      bestDist = dist
      best = markers[idx]
    }
  }

  return best
}

export function markerRadius(_msPerPixel: number, clusterMode = false): number {
  return clusterMode ? 6 : 4
}

/** White fill + blue stroke — reference chart style */
export function drawReferenceDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  strokeColor = MARKER_COLORS.PASS,
) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2.5
  ctx.stroke()
}

export function drawCountLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  strokeColor = MARKER_COLORS.PASS,
) {
  ctx.font = '700 12px Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, x, y)
}

export function cumulativeY(
  cumulative: number,
  maxCumulative: number,
  segH: number,
  top = 36,
  bottom = 24,
): number {
  const plotTop = top
  const plotBottom = segH - bottom
  const plotH = plotBottom - plotTop
  if (maxCumulative <= 0) return plotBottom
  return plotBottom - (cumulative / maxCumulative) * plotH
}

export function drawIndividualMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  isFail: boolean,
) {
  if (isFail) {
    ctx.beginPath()
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2)
    ctx.fillStyle = MARKER_COLORS.FAIL_FILL
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.strokeStyle = MARKER_COLORS.FAIL
    ctx.lineWidth = 2
    const s = radius + 1
    ctx.beginPath()
    ctx.moveTo(x - s, y - s)
    ctx.lineTo(x + s, y + s)
    ctx.moveTo(x + s, y - s)
    ctx.lineTo(x - s, y + s)
    ctx.stroke()
    return
  }

  drawCleanDot(ctx, x, y, radius, MARKER_COLORS.PASS)
}

export function drawCleanDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fill: string,
) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.stroke()
}

export { MARKER_COLORS }
