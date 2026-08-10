import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Button, Paper, Stack, Tooltip, Typography } from '@mui/material'
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'
import type { ChartSegment, ProduceMarker } from '../../types/api'
import {
  CHART,
  MARKER_COLORS,
  SEGMENT_COLORS,
  SEGMENT_LABELS,
  totalChartHeight,
} from '../../utils/chartLayout'
import { msToIstLabel, nowIst } from '../../utils/timezone'
import {
  cumulativeY,
  drawCountLabel,
  drawIndividualMarker,
  drawReferenceDot,
  findNearestProductionPoint,
  markerRadius,
  msToX,
  prepareMarkers,
  selectMarkersForDraw,
  xToMs,
} from '../../utils/produceMarkers'
import ChartLegend from './ChartLegend'

interface TimelineChartProps {
  segments: ChartSegment[]
  markers: ProduceMarker[]
  viewStartMs: number
  viewEndMs: number
  fullStartMs: number
  fullEndMs: number
  clusterMode?: boolean
  showIndividualProduces?: boolean
  onZoom: (startMs: number, endMs: number) => void
  onResetZoom: () => void
}

function TimelineChart({
  segments,
  markers,
  viewStartMs,
  viewEndMs,
  fullStartMs,
  fullEndMs,
  clusterMode = false,
  showIndividualProduces = false,
  onZoom,
  onResetZoom,
}: TimelineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(800)
  const [isBrushing, setIsBrushing] = useState(false)
  const [brushStart, setBrushStart] = useState<number | null>(null)
  const [brushEnd, setBrushEnd] = useState<number | null>(null)
  const [hovered, setHovered] = useState<{
    timestampMs: number
    result: 'PASS' | 'FAIL'
    count: number
    produceId?: string
  } | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const prepared = useMemo(() => prepareMarkers(markers), [markers])
  const totalProduces = useMemo(
    () => markers.reduce((sum, m) => sum + (m.count ?? 1), 0),
    [markers],
  )
  const drawMarkers = useMemo(
    () => selectMarkersForDraw(prepared, viewStartMs, viewEndMs, width, clusterMode),
    [prepared, viewStartMs, viewEndMs, width, clusterMode],
  )
  const isZoomed = viewStartMs > fullStartMs || viewEndMs < fullEndMs
  const chartHeight = totalChartHeight()

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    ro.observe(node)
    setWidth(node.clientWidth)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || width <= 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = chartHeight * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${chartHeight}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, chartHeight)

    const segH = CHART.SEGMENT_LANE_HEIGHT
    const axisY = segH
    const viewSpan = viewEndMs - viewStartMs
    const msPerPixel = viewSpan / width

    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, width, segH)
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, axisY, width, CHART.AXIS_HEIGHT)

    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, axisY)
    ctx.lineTo(width, axisY)
    ctx.stroke()

    ctx.fillStyle = '#757575'
    ctx.font = '600 10px Roboto, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Machine State & Production', 6, 14)

    const hourMs = 3600000
    const firstHour = Math.ceil(viewStartMs / hourMs) * hourMs
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    for (let h = firstHour; h < viewEndMs; h += hourMs) {
      const x = msToX(h, viewStartMs, viewEndMs, width)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, axisY)
      ctx.stroke()
    }

    for (const seg of segments) {
      if (seg.endMs <= viewStartMs || seg.startMs >= viewEndMs) continue

      const x1 = msToX(Math.max(seg.startMs, viewStartMs), viewStartMs, viewEndMs, width)
      const x2 = msToX(Math.min(seg.endMs, viewEndMs), viewStartMs, viewEndMs, width)
      const w = Math.max(x2 - x1, 1)

      ctx.fillStyle = SEGMENT_COLORS[seg.kind]
      ctx.globalAlpha = 0.92
      ctx.fillRect(x1, 22, w, segH - 28)
      ctx.globalAlpha = 1

      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(x1, 22, w, segH - 28)

      if (w > 48) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.font = '700 9px Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (w > 80) {
          ctx.fillText(SEGMENT_LABELS[seg.kind].toUpperCase(), x1 + w / 2, segH / 2 + 4)
        }
      }
    }

    const radius = markerRadius(msPerPixel, clusterMode)
    const lineTop = CHART.PRODUCTION_LINE_TOP
    const lineBottom = CHART.PRODUCTION_LINE_BOTTOM

    if (clusterMode && drawMarkers.length > 0) {
      const visible = drawMarkers
        .filter((dm) => !dm.isFail)
        .sort((a, b) => a.timestampMs - b.timestampMs)
      const maxCumulative = Math.max(
        ...visible.map((dm) => dm.cumulativeCount ?? dm.count),
        1,
      )

      const points = visible.map((dm) => ({
        x: msToX(dm.timestampMs, viewStartMs, viewEndMs, width),
        y: cumulativeY(
          dm.cumulativeCount ?? dm.count,
          maxCumulative,
          segH,
          lineTop,
          lineBottom,
        ),
        count: dm.count,
        dm,
      }))

      if (points.length > 1) {
        ctx.strokeStyle = MARKER_COLORS.PASS
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.stroke()
      }

      for (const pt of points) {
        drawReferenceDot(ctx, pt.x, pt.y, radius)
        drawCountLabel(ctx, pt.x + radius + 6, pt.y, String(pt.count))
      }
    } else {
      const yCenter = segH / 2 + 6
      for (const dm of drawMarkers) {
        const x = msToX(dm.timestampMs, viewStartMs, viewEndMs, width)
        drawIndividualMarker(ctx, x, yCenter, radius, dm.isFail)
      }
    }

    const nowMs = nowIst().toMillis()
    if (nowMs >= viewStartMs && nowMs <= viewEndMs) {
      const nx = msToX(nowMs, viewStartMs, viewEndMs, width)
      ctx.strokeStyle = '#1565C0'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(nx, 0)
      ctx.lineTo(nx, axisY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#1565C0'
      ctx.font = '700 9px Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('NOW', nx, 10)
    }

    if (isBrushing && brushStart !== null && brushEnd !== null) {
      const x1 = Math.min(brushStart, brushEnd)
      const w = Math.abs(brushEnd - brushStart)
      ctx.fillStyle = 'rgba(21, 101, 192, 0.15)'
      ctx.fillRect(x1, 0, w, axisY)
      ctx.strokeStyle = '#1565C0'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x1, 0, w, axisY)
    }

    const tickCount = Math.min(8, Math.max(4, Math.floor(width / 100)))
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i <= tickCount; i++) {
      const ms = viewStartMs + (viewSpan * i) / tickCount
      const x = msToX(ms, viewStartMs, viewEndMs, width)
      ctx.fillStyle = '#616161'
      ctx.font = '500 10px Roboto, sans-serif'
      ctx.fillText(msToIstLabel(ms), x, axisY + 6)
      ctx.strokeStyle = '#bdbdbd'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, axisY)
      ctx.lineTo(x, axisY + 4)
      ctx.stroke()
    }
  }, [
    width,
    chartHeight,
    segments,
    drawMarkers,
    viewStartMs,
    viewEndMs,
    isBrushing,
    brushStart,
    brushEnd,
    clusterMode,
  ])

  useEffect(() => {
    const frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [draw])

  const getLocalX = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    return rect ? clientX - rect.left : 0
  }

  const finishBrush = useCallback(
    (start: number | null, end: number | null) => {
      if (start === null || end === null) return
      const x1 = Math.min(start, end)
      const x2 = Math.max(start, end)
      const startMs = xToMs(x1, viewStartMs, viewEndMs, width)
      const endMs = xToMs(x2, viewStartMs, viewEndMs, width)
      if (endMs - startMs >= CHART.MIN_ZOOM_MS) {
        onZoom(startMs, endMs)
      }
    },
    [viewStartMs, viewEndMs, width, onZoom],
  )

  useEffect(() => {
    if (!isBrushing) return

    const onMove = (e: MouseEvent) => setBrushEnd(getLocalX(e.clientX))
    const onUp = (e: MouseEvent) => {
      const endX = getLocalX(e.clientX)
      setIsBrushing(false)
      setBrushStart((start) => {
        finishBrush(start, endX)
        return null
      })
      setBrushEnd(null)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isBrushing, finishBrush])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const x = getLocalX(e.clientX)
    setIsBrushing(true)
    setBrushStart(x)
    setBrushEnd(x)
    setHovered(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isBrushing) return
    const x = getLocalX(e.clientX)
    const y = e.nativeEvent.offsetY
    setHovered(
      findNearestProductionPoint(
        drawMarkers,
        prepared,
        x,
        y,
        viewStartMs,
        viewEndMs,
        width,
        CHART.SEGMENT_LANE_HEIGHT,
        clusterMode,
      ),
    )
    setHoverPos({ x, y })
  }

  return (
    <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }} elevation={2}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
        <ChartLegend
          markerCount={markers.length}
          totalProduces={totalProduces}
          clusterMode={clusterMode}
          showIndividualProduces={showIndividualProduces}
          isZoomed={isZoomed}
        />
        {isZoomed && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<ZoomOutMapIcon />}
            onClick={onResetZoom}
            sx={{ flexShrink: 0 }}
          >
            Reset Zoom
          </Button>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
        Drag to select a time range and zoom in · double-click to reset
        {showIndividualProduces
          ? ' · individual PASS/FAIL markers (downsampled when zoomed out, FAILs never dropped)'
          : ' · hourly pass count shown on chart'}
      </Typography>

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          cursor: isBrushing ? 'col-resize' : 'crosshair',
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        onDoubleClick={onResetZoom}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />

        {hovered && (
          <Tooltip
            open
            placement="top"
            title={
              <Box sx={{ py: 0.5, textAlign: 'center' }}>
                <Typography variant="body2" display="block" fontWeight={800} lineHeight={1.2}>
                  {showIndividualProduces
                    ? hovered.result
                    : `${hovered.count.toLocaleString()} ${hovered.result}`}
                </Typography>
                {!showIndividualProduces && hovered.result === 'PASS' && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    Hourly pass count
                  </Typography>
                )}
                <Typography variant="caption" display="block" color="text.secondary">
                  {msToIstLabel(hovered.timestampMs, 'dd MMM yyyy, HH:mm:ss')}
                </Typography>
                {hovered.produceId && (
                  <Typography variant="caption" display="block" color="text.secondary">
                    ID: {hovered.produceId}
                  </Typography>
                )}
              </Box>
            }
          >
            <Box
              sx={{
                position: 'absolute',
                left: hoverPos.x,
                top: hoverPos.y,
                width: 1,
                height: 1,
                pointerEvents: 'none',
              }}
            />
          </Tooltip>
        )}
      </Box>
    </Paper>
  )
}

export default memo(TimelineChart)
