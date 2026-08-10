import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

/** Pull a human-readable message from MES envelopes, FastAPI errors, or plain strings. */
export function extractApiErrorMessage(data: unknown): string | null {
  if (data == null) return null
  if (typeof data === 'string') {
    const trimmed = data.trim()
    return trimmed || null
  }

  if (typeof data !== 'object') return null

  const obj = data as Record<string, unknown>

  if (typeof obj.message === 'string' && obj.message.trim()) {
    return obj.message.trim()
  }

  if (Array.isArray(obj.detail)) {
    const parts = obj.detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'msg' in item) {
          const entry = item as { msg?: string; loc?: unknown[] }
          const loc = Array.isArray(entry.loc) ? entry.loc.filter(Boolean).join(' → ') : ''
          return loc && entry.msg ? `${loc}: ${entry.msg}` : entry.msg ?? null
        }
        return null
      })
      .filter((part): part is string => Boolean(part))
    if (parts.length > 0) return parts.join(' · ')
  }

  if (typeof obj.detail === 'string' && obj.detail.trim()) {
    return obj.detail.trim()
  }

  if (typeof obj.error === 'string' && obj.error.trim()) {
    return obj.error.trim()
  }

  return null
}

const TECHNICAL_MESSAGE_MAP: Record<string, string> = {
  'not found': 'We could not find data for this selection. Try another date, machine, or shift.',
  'unauthorized': 'Your session has expired. Please sign in again.',
  'forbidden': 'You do not have permission to view this data.',
  'internal server error': 'Something went wrong on our side. Please try again in a moment.',
  'bad gateway': 'The service is temporarily unavailable. Please try again shortly.',
  'service unavailable': 'The service is temporarily unavailable. Please try again shortly.',
  'gateway timeout': 'The request took too long. Please check your connection and retry.',
}

function humanizeMessage(message: string, status: number | string): string {
  const normalized = message.trim().toLowerCase()
  const mapped = TECHNICAL_MESSAGE_MAP[normalized]
  if (mapped) return mapped

  // Hide bare technical labels from the API
  if (/^(not found|unauthorized|forbidden|error|failed)$/i.test(message.trim())) {
    return getDefaultMessageForStatus(status)
  }

  return message.trim()
}

export function getDefaultMessageForStatus(status: number | string): string {
  switch (status) {
    case 'FETCH_ERROR':
      return 'Unable to reach the server. Please check your internet connection and try again.'
    case 'PARSING_ERROR':
      return 'We received an unexpected response. Please try again.'
    case 'TIMEOUT_ERROR':
      return 'The request took too long. Please try again.'
    case 'CUSTOM_ERROR':
      return 'Something went wrong. Please try again.'
    case 400:
      return 'Something in your selection looks invalid. Please check the filters and try again.'
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have permission to view this data.'
    case 404:
      return 'We could not find data for this selection. Try another date, machine, or shift.'
    case 422:
      return 'Some of the selected values are not valid. Please review your filters and try again.'
    case 500:
      return 'Something went wrong on our side. Please try again in a moment.'
    case 502:
    case 503:
      return 'The service is temporarily unavailable. Please try again shortly.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

/** Normalize RTK Query / HTTP errors into a single user-friendly display string. */
export function formatApiError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return fallback
  }

  const { status, data } = error as FetchBaseQueryError
  const extracted = extractApiErrorMessage(data)
  const message = extracted ?? getDefaultMessageForStatus(status)

  return humanizeMessage(message, status)
}

/** Convert fetch errors so `error.data` is always a readable string when possible. */
export function normalizeFetchError(error: FetchBaseQueryError): FetchBaseQueryError {
  const extracted = extractApiErrorMessage(error.data)
  if (extracted) {
    return {
      ...error,
      data: humanizeMessage(extracted, error.status),
    } as FetchBaseQueryError
  }

  if (typeof error.data === 'object' && error.data !== null && 'data' in error) {
    return {
      ...error,
      data: getDefaultMessageForStatus(error.status),
    } as FetchBaseQueryError
  }

  return error
}
