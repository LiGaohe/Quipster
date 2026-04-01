import http from '@/lib/http'
import type {
  ApiResponse,
  RegisterDto,
  RegisterResponse,
  LoginDto,
  LoginResponse,
} from '@/types'

export const authApi = {
  register: (dto: RegisterDto) =>
    http.post<RegisterResponse>('/auth/register', dto),

  login: (dto: LoginDto) =>
    http.post<LoginResponse>('/auth/login', dto),

  logout: () =>
    http.post<ApiResponse>('/auth/logout'),
}
