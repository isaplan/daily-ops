/**
 * @registry-id: authService
 * @created: 2026-01-16T00:00:00.000Z
 * @last-modified: 2026-01-16T00:00:00.000Z
 * @description: Authentication API service - extends existing useAuth pattern
 * @last-fix: [2026-01-16] Initial implementation
 * 
 * @imports-from:
 *   - app/lib/services/base.ts => ApiService base class
 * 
 * @exports-to:
 *   ✓ app/lib/viewmodels/** => ViewModels use authService for auth operations
 */

import { ApiService, type ApiResponse } from './base'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'member' | 'manager' | 'admin'
  location_id?: string
  team_id?: string
}

export interface LoginDto {
  email: string
  password: string
}

class AuthService extends ApiService {
  constructor() {
    super('/api')
  }

  async getCurrentUser(): Promise<ApiResponse<AuthUser>> {
    return this.get<AuthUser>('/auth/me')
  }

  async login(data: LoginDto): Promise<ApiResponse<AuthUser>> {
    return this.post<AuthUser>('/auth/login', data)
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.post<void>('/auth/logout', {})
  }
}

export const authService = new AuthService()
