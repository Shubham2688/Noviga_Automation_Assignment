import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { FlatAsset, ParsedShift } from '../types/api'

interface ZoomRange {
  startMs: number
  endMs: number
}

interface DashboardFiltersState {
  selectedAsset: FlatAsset | null
  selectedShift: ParsedShift | null
  selectedDate: string
  showIndividualProduces: boolean
  zoomRange: ZoomRange | null
}

const initialState: DashboardFiltersState = {
  selectedAsset: null,
  selectedShift: null,
  selectedDate: '2026-06-23',
  showIndividualProduces: false,
  zoomRange: null,
}

const dashboardFiltersSlice = createSlice({
  name: 'dashboardFilters',
  initialState,
  reducers: {
    setSelectedAsset(state, action: PayloadAction<FlatAsset | null>) {
      state.selectedAsset = action.payload
      state.zoomRange = null
    },
    setSelectedShift(state, action: PayloadAction<ParsedShift | null>) {
      state.selectedShift = action.payload
      state.zoomRange = null
    },
    setSelectedDate(state, action: PayloadAction<string>) {
      state.selectedDate = action.payload
      state.zoomRange = null
    },
    setShowIndividualProduces(state, action: PayloadAction<boolean>) {
      state.showIndividualProduces = action.payload
    },
    setZoomRange(state, action: PayloadAction<ZoomRange | null>) {
      state.zoomRange = action.payload
    },
    resetZoom(state) {
      state.zoomRange = null
    },
  },
})

export const {
  setSelectedAsset,
  setSelectedShift,
  setSelectedDate,
  setShowIndividualProduces,
  setZoomRange,
  resetZoom,
} = dashboardFiltersSlice.actions

export default dashboardFiltersSlice.reducer
