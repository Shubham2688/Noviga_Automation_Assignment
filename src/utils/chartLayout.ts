import type { SegmentKind } from '../types/api'

export const CHART = {
  SEGMENT_LANE_HEIGHT: 260,
  MARKER_LANE_HEIGHT: 0,
  AXIS_HEIGHT: 32,
  PADDING_LEFT: 8,
  PADDING_RIGHT: 8,
  MIN_ZOOM_MS: 60_000,
  PRODUCTION_LINE_TOP: 36,
  PRODUCTION_LINE_BOTTOM: 24,
} as const

export function totalChartHeight(): number {
  return CHART.SEGMENT_LANE_HEIGHT + CHART.MARKER_LANE_HEIGHT + CHART.AXIS_HEIGHT
}

export const SEGMENT_COLORS: Record<SegmentKind, string> = {
  runtime: '#00897B',
  unplanned_production: '#AFB42B',
  unknown_downtime: '#FF7043',
  stoppage: '#8E24AA',
}

export const SEGMENT_LABELS: Record<SegmentKind, string> = {
  runtime: 'Runtime',
  unplanned_production: 'Unplanned Prod.',
  unknown_downtime: 'Unknown DT',
  stoppage: 'Stoppage',
}

export const MARKER_COLORS = {
  PASS: '#1565C0',
  FAIL: '#D32F2F',
  PASS_FILL: '#E3F2FD',
  FAIL_FILL: '#FFEBEE',
}
