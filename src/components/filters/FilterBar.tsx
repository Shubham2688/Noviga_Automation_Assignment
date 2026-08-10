import { useEffect } from 'react'
import { Alert, Box, FormControl, IconButton, InputLabel, MenuItem, Select, Switch, FormControlLabel, Tooltip, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon'
import { DateTime } from 'luxon'
import { IST_ZONE } from '../../utils/timezone'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  setSelectedAsset,
  setSelectedDate,
  setSelectedShift,
  setShowIndividualProduces,
} from '../../store/dashboardFiltersSlice'
import {
  buildShiftWindow,
  flattenAssetTree,
  parseShifts,
  pickDefaultAsset,
  pickDefaultShift,
} from '../../utils/shiftWindow'
import { useGetAssetsTreeQuery, useGetShiftsQuery, baseApi } from '../../store/api/baseApi'
import { formatApiError } from '../../utils/apiError'

export default function FilterBar() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((s) => s.dashboardFilters)

  const { data: assetsTree, error: assetsError } = useGetAssetsTreeQuery()
  const { data: shiftsData, error: shiftsError } = useGetShiftsQuery()

  const flatAssets = assetsTree ? flattenAssetTree(assetsTree) : []
  const parsedShifts = shiftsData ? parseShifts(shiftsData) : []

  useEffect(() => {
    if (!filters.selectedAsset && flatAssets.length > 0) {
      dispatch(setSelectedAsset(pickDefaultAsset(flatAssets)))
    }
  }, [flatAssets, filters.selectedAsset, dispatch])

  useEffect(() => {
    if (!filters.selectedShift && parsedShifts.length > 0) {
      dispatch(setSelectedShift(pickDefaultShift(parsedShifts)))
    }
  }, [parsedShifts, filters.selectedShift, dispatch])

  useEffect(() => {
    if (!filters.selectedShift || parsedShifts.length === 0) return
    const stillValid = parsedShifts.some((s) => s.id === filters.selectedShift?.id)
    if (!stillValid) {
      dispatch(setSelectedShift(pickDefaultShift(parsedShifts)))
    }
  }, [parsedShifts, filters.selectedShift, dispatch])

  const shiftWindow =
    filters.selectedShift
      ? buildShiftWindow(filters.selectedDate, filters.selectedShift)
      : null

  const handleRefresh = () => {
    dispatch(baseApi.util.invalidateTags(['Intervals', 'CycleTime']))
  }

  const selectedDate = DateTime.fromFormat(filters.selectedDate, 'yyyy-MM-dd', {
    zone: IST_ZONE,
  })

  return (
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      <Box
        display="flex"
        flexWrap="wrap"
        gap={2}
        alignItems="center"
        bgcolor="background.paper"
        p={2}
        borderRadius={1}
        boxShadow={1}
        mb={2}
      >
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Machine / Line</InputLabel>
          <Select
            label="Machine / Line"
            value={filters.selectedAsset?.id ?? ''}
            onChange={(e) => {
              const asset = flatAssets.find((a) => a.id === e.target.value) ?? null
              dispatch(setSelectedAsset(asset))
            }}
          >
            {flatAssets.map((asset) => (
              <MenuItem key={asset.id} value={asset.id}>
                {asset.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Shift</InputLabel>
          <Select
            label="Shift"
            value={filters.selectedShift?.id ?? ''}
            onChange={(e) => {
              const shift = parsedShifts.find((s) => s.id === e.target.value) ?? null
              dispatch(setSelectedShift(shift))
            }}
          >
            {parsedShifts.map((shift) => (
              <MenuItem key={shift.id} value={shift.id}>
                {shift.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <DatePicker
          label="Date"
          value={selectedDate}
          onChange={(val) => {
            if (val?.isValid) {
              dispatch(setSelectedDate(val.toFormat('yyyy-MM-dd')))
            }
          }}
          minDate={DateTime.fromISO('2026-06-22', { zone: IST_ZONE })}
          maxDate={DateTime.fromISO('2026-06-25', { zone: IST_ZONE })}
          slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={filters.showIndividualProduces}
              onChange={(e) => dispatch(setShowIndividualProduces(e.target.checked))}
            />
          }
          label="Show individual produces"
        />

        <Tooltip title="Refresh data">
          <IconButton onClick={handleRefresh} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>

        {filters.selectedAsset && filters.selectedShift && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {filters.selectedAsset.label} · {filters.selectedDate}
          </Typography>
        )}
      </Box>

      {(assetsError || shiftsError) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {assetsError
            ? formatApiError(
                assetsError,
                'We could not load the machine list. Please refresh the page.',
              )
            : formatApiError(
                shiftsError,
                'We could not load shift options. Please refresh the page.',
              )}
        </Alert>
      )}

      {shiftWindow && (
        <Alert severity="info" sx={{ mb: 2, py: 0.5 }} icon={false}>
          <Typography variant="body2">
            <strong>Query window (IST):</strong> {shiftWindow.istLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            API: {shiftWindow.fromTs} → {shiftWindow.toTs} (UTC)
          </Typography>
        </Alert>
      )}
    </LocalizationProvider>
  )
}
