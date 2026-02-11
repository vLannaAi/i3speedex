import type { ApiResponse, PaginatedResponse } from '~/types/api'

export function useApi() {
  const config = useRuntimeConfig()
  const { getIdToken, refreshSession, logout } = useAuth()

  async function request<T>(
    path: string,
    options: {
      method?: string
      body?: unknown
      query?: Record<string, string | number | undefined>
    } = {},
  ): Promise<T> {
    const token = getIdToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Clean undefined values from query params
    const query: Record<string, string> = {}
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null && value !== '') {
          query[key] = String(value)
        }
      }
    }

    try {
      const response = await $fetch<T>(`${config.public.apiBaseUrl}${path}`, {
        method: (options.method || 'GET') as any,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        query: Object.keys(query).length > 0 ? query : undefined,
      })
      return response
    } catch (error: any) {
      // Auto-refresh on 401 and retry once
      if (error?.response?.status === 401 || error?.statusCode === 401) {
        const newSession = await refreshSession()
        if (newSession) {
          const newToken = getIdToken()
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`
          }
          try {
            return await $fetch<T>(`${config.public.apiBaseUrl}${path}`, {
              method: (options.method || 'GET') as any,
              headers,
              body: options.body ? JSON.stringify(options.body) : undefined,
              query: Object.keys(query).length > 0 ? query : undefined,
            })
          } catch {
            logout()
            throw error
          }
        } else {
          logout()
        }
      }
      // Extract error message from API response
      const message = error?.data?.message || error?.response?._data?.message || error?.message || 'Network error'
      throw new Error(message)
    }
  }

  function get<T>(path: string, query?: Record<string, string | number | undefined>) {
    return request<ApiResponse<T>>(path, { query })
  }

  function getList<T>(path: string, query?: Record<string, string | number | undefined>) {
    return request<PaginatedResponse<T>>(path, { query })
  }

  function post<T>(path: string, body?: unknown) {
    return request<ApiResponse<T>>(path, { method: 'POST', body })
  }

  function put<T>(path: string, body?: unknown) {
    return request<ApiResponse<T>>(path, { method: 'PUT', body })
  }

  function del<T>(path: string) {
    return request<ApiResponse<T>>(path, { method: 'DELETE' })
  }

  return { request, get, getList, post, put, del }
}
