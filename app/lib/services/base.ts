/**
 * @registry-id: apiServiceBase
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Base API service with generic CRUD methods, error handling, type-safe responses
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @exports-to:
 *   ✓ app/lib/services/** => All domain services extend this base
 */

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ApiError {
  message: string
  status?: number
  code?: string
}

export class ApiServiceError extends Error {
  status?: number
  code?: string

  constructor(message: string, status?: number, code?: string) {
    super(message)
    this.name = 'ApiServiceError'
    this.status = status
    this.code = code
  }
}

/**
 * Base API service class with generic CRUD methods
 */
export class ApiService {
  protected baseUrl: string

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  /**
   * Generic GET request
   */
  protected async get<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiServiceError(
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          errorData.code
        )
      }

      const data = await response.json()
      return {
        success: true,
        data: data.data || data,
      }
    } catch (error) {
      if (error instanceof ApiServiceError) {
        throw error
      }
      throw new ApiServiceError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }

  /**
   * Generic POST request
   */
  protected async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiServiceError(
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          errorData.code
        )
      }

      const data = await response.json()
      return {
        success: true,
        data: data.data || data,
      }
    } catch (error) {
      if (error instanceof ApiServiceError) {
        throw error
      }
      throw new ApiServiceError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }

  /**
   * Generic PUT request
   */
  protected async put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiServiceError(
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          errorData.code
        )
      }

      const data = await response.json()
      return {
        success: true,
        data: data.data || data,
      }
    } catch (error) {
      if (error instanceof ApiServiceError) {
        throw error
      }
      throw new ApiServiceError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }

  /**
   * Generic DELETE request
   */
  protected async delete<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiServiceError(
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          errorData.code
        )
      }

      const data = await response.json().catch(() => ({ success: true }))
      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      if (error instanceof ApiServiceError) {
        throw error
      }
      throw new ApiServiceError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }

  /**
   * Generic PATCH request
   */
  protected async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiServiceError(
          errorData.error || `HTTP error! status: ${response.status}`,
          response.status,
          errorData.code
        )
      }

      const data = await response.json()
      return {
        success: true,
        data: data.data || data,
      }
    } catch (error) {
      if (error instanceof ApiServiceError) {
        throw error
      }
      throw new ApiServiceError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }
}
