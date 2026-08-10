import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import type {
  AssetNode,
  CycleTimeBucket,
  EntityScope,
  LoginRequest,
  LoginResponse,
  MachineIntervalsResponse,
  Shift,
  TimeRange,
  User,
} from '../../types/api'
import { clearAuth } from '../authSlice'
import type { RootState } from '../store'
import { getBaseUrl } from '../../api/client'

interface MesWrapper<T> {
  trace_id: string
  status_code: number
  message: string
  data: T
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getBaseUrl(),
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    headers.set('Content-Type', 'application/json')
    return headers
  },
})

const baseQueryWithEnvelope: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let lastResult = await rawBaseQuery(args, api, extraOptions)

  if (lastResult.error?.status === 500) {
    for (let attempt = 0; attempt < 2; attempt++) {
      await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt)))
      lastResult = await rawBaseQuery(args, api, extraOptions)
      if (lastResult.error?.status !== 500) break
    }
  }

  if (lastResult.error) {
    const status = lastResult.error.status
    if (status === 401) {
      const url = typeof args === 'string' ? args : args.url
      if (!url.includes('/auth/login')) {
        api.dispatch(clearAuth())
      }
    }
    return lastResult
  }

  const envelope = lastResult.data as MesWrapper<unknown>
  if (envelope.status_code >= 400) {
    if (envelope.status_code === 401) {
      const url = typeof args === 'string' ? args : args.url
      if (!url.includes('/auth/login')) {
        api.dispatch(clearAuth())
      }
    }
    return {
      error: {
        status: envelope.status_code,
        data: envelope.message,
      } as FetchBaseQueryError,
    }
  }

  return { data: envelope.data }
}

export interface DashboardQueryArgs {
  entityScope: EntityScope
  timeRange: TimeRange
  exactProduces: boolean
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithEnvelope,
  tagTypes: ['User', 'Assets', 'Shifts', 'Intervals', 'CycleTime'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
    }),
    getMe: builder.query<User, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
    }),
    logout: builder.mutation<null, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),
    getAssetsTree: builder.query<AssetNode[], void>({
      query: () => '/core/assets/tree',
      providesTags: ['Assets'],
    }),
    getShifts: builder.query<Shift[], void>({
      query: () => '/core/shifts',
      providesTags: ['Shifts'],
    }),
    getMachineIntervals: builder.query<MachineIntervalsResponse, DashboardQueryArgs>({
      query: ({ entityScope, timeRange, exactProduces }) => ({
        url: '/analytics-query/machine-intervals',
        method: 'POST',
        body: {
          entity_scope: entityScope,
          time_range: timeRange,
          produce_counts: true,
          exact_produces: exactProduces,
          group_produce_counts_by_part_model: true,
        },
      }),
      providesTags: ['Intervals'],
    }),
    getCycleTimeMetrics: builder.query<
      CycleTimeBucket[],
      { entityScope: EntityScope; timeRange: TimeRange }
    >({
      query: ({ entityScope, timeRange }) => ({
        url: '/analytics-query',
        method: 'POST',
        body: {
          entity_scope: entityScope,
          metrics: ['ideal_cycle_time_seconds', 'actual_cycle_time_seconds'],
          time_range: timeRange,
          distribution: 'hourly',
        },
      }),
      providesTags: ['CycleTime'],
    }),
  }),
})

export const {
  useLoginMutation,
  useGetMeQuery,
  useLogoutMutation,
  useGetAssetsTreeQuery,
  useGetShiftsQuery,
  useGetMachineIntervalsQuery,
  useGetCycleTimeMetricsQuery,
} = baseApi
