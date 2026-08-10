const TOKEN_KEY = 'timeline_dashboard_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'https://fractaldmsdev.centralindia.cloudapp.azure.com'
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface FetchOptions {
  method?: string
  body?: unknown
  token?: string | null
  skipAuth?: boolean
  retries?: number
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, token, skipAuth = false, retries = 2 } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (!skipAuth && token) {
    headers.Authorization = `Bearer ${token}`
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${getBaseUrl()}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })

      const envelope = await response.json()

      if (envelope.status_code >= 400) {
        const error = {
          status: envelope.status_code,
          message: envelope.message ?? 'Request failed',
        }
        if (envelope.status_code === 500 && attempt < retries) {
          await sleep(300 * Math.pow(3, attempt))
          continue
        }
        throw error
      }

      return envelope.data as T
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < retries && !(err && typeof err === 'object' && 'status' in err)) {
        await sleep(300 * Math.pow(3, attempt))
        continue
      }
      throw err
    }
  }

  throw lastError ?? new Error('Request failed')
}
