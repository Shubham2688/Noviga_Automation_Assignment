import { useMemo } from 'react'
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material'
import AppShell from '../components/layout/AppShell'
import FilterBar from '../components/filters/FilterBar'
import TimelineChart from '../components/chart/TimelineChart'
import HourlySummaryTable from '../components/table/HourlySummaryTable'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  useGetCycleTimeMetricsQuery,
  useGetMachineIntervalsQuery,
} from '../store/api/baseApi'
import { buildShiftWindow } from '../utils/shiftWindow'
import {
  buildChartSegments,
  buildCoarseMarkers,
  buildExactMarkers,
} from '../utils/chartData'
import { buildHourlyTable } from '../utils/hourlyTable'
import { resetZoom, setZoomRange } from '../store/dashboardFiltersSlice'
import { formatApiError } from '../utils/apiError'

export default function DashboardPage() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((s) => s.dashboardFilters)

  const shiftWindow = useMemo(() => {
    if (!filters.selectedShift) return null
    return buildShiftWindow(filters.selectedDate, filters.selectedShift)
  }, [filters.selectedDate, filters.selectedShift])

  const entityScope = useMemo(() => {
    if (!filters.selectedAsset) return null
    return {
      type: 'asset' as const,
      asset: {
        asset_id: filters.selectedAsset.id,
        asset_level_id: filters.selectedAsset.assetlevel_id,
      },
    }
  }, [filters.selectedAsset])

  const queryArgs = useMemo(() => {
    if (!entityScope || !shiftWindow) return null
    return {
      entityScope,
      timeRange: { from_ts: shiftWindow.fromTs, to_ts: shiftWindow.toTs },
      exactProduces: filters.showIndividualProduces,
    }
  }, [entityScope, shiftWindow, filters.showIndividualProduces])

  const cycleArgs = useMemo(() => {
    if (!entityScope || !shiftWindow) return null
    return {
      entityScope,
      timeRange: { from_ts: shiftWindow.fromTs, to_ts: shiftWindow.toTs },
    }
  }, [entityScope, shiftWindow])

  const {
    data: intervals,
    isLoading: intervalsLoading,
    isFetching: intervalsFetching,
    error: intervalsError,
    refetch: refetchIntervals,
  } = useGetMachineIntervalsQuery(queryArgs!, { skip: !queryArgs })

  const {
    data: cycleTime,
    isLoading: cycleLoading,
    isFetching: cycleFetching,
    error: cycleError,
    refetch: refetchCycle,
  } = useGetCycleTimeMetricsQuery(cycleArgs!, { skip: !cycleArgs })

  const isLoading = intervalsLoading || cycleLoading
  const isFetching = intervalsFetching || cycleFetching

  const viewStartMs = filters.zoomRange?.startMs ?? shiftWindow?.fromMs ?? 0
  const viewEndMs = filters.zoomRange?.endMs ?? shiftWindow?.toMs ?? 0

  const segments = useMemo(
    () =>
      intervals && shiftWindow
        ? buildChartSegments(intervals, shiftWindow.fromMs, shiftWindow.toMs)
        : [],
    [intervals, shiftWindow],
  )

  const markers = useMemo(() => {
    if (!intervals || !shiftWindow) return []
    const clip = { from: shiftWindow.fromMs, to: shiftWindow.toMs }
    return filters.showIndividualProduces
      ? buildExactMarkers(intervals, clip.from, clip.to)
      : buildCoarseMarkers(intervals, shiftWindow.hourBuckets)
  }, [intervals, shiftWindow, filters.showIndividualProduces])

  const hourlyBuckets = useMemo(() => {
    if (!intervals || !cycleTime || !shiftWindow) return []
    return buildHourlyTable(intervals, cycleTime, shiftWindow)
  }, [intervals, cycleTime, shiftWindow])

  const isEmpty =
    intervals &&
    intervals.runtimes.length === 0 &&
    intervals.downtimes.length === 0 &&
    intervals.produce_counts.length === 0

  const handleRetry = () => {
    refetchIntervals()
    refetchCycle()
  }

  const errorMessage = useMemo(() => {
    if (intervalsError) {
      return formatApiError(
        intervalsError,
        'We could not load the production timeline. Please try again.',
      )
    }
    if (cycleError) {
      return formatApiError(
        cycleError,
        'We could not load cycle time details. Please try again.',
      )
    }
    return null
  }, [intervalsError, cycleError])

  return (
    <AppShell>
      <FilterBar />

      {isLoading && (
        <Box>
          <Skeleton variant="rectangular" height={340} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1 }} />
        </Box>
      )}

      {errorMessage && !isLoading && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {errorMessage}
        </Alert>
      )}

      {!isLoading && !errorMessage && isEmpty && (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary">No data for this shift.</Typography>
        </Box>
      )}

      {!isLoading && !errorMessage && intervals && shiftWindow && !isEmpty && (
        <>
          {isFetching && (
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Updating…
            </Typography>
          )}
          <TimelineChart
            segments={segments}
            markers={markers}
            viewStartMs={viewStartMs}
            viewEndMs={viewEndMs}
            fullStartMs={shiftWindow.fromMs}
            fullEndMs={shiftWindow.toMs}
            clusterMode={!filters.showIndividualProduces}
            showIndividualProduces={filters.showIndividualProduces}
            onZoom={(startMs, endMs) =>
              dispatch(setZoomRange({ startMs, endMs }))
            }
            onResetZoom={() => dispatch(resetZoom())}
          />
          <HourlySummaryTable buckets={hourlyBuckets} />
        </>
      )}
    </AppShell>
  )
}
