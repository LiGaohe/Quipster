import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  User,
  UserBasic,
  UpdateUserDto,
  SearchUsersParams,
} from '@/types'

export const usersApi = {
  getUser: (id: string) =>
    http.get<ApiResponse<User>>(`/users/${id}`),

  updateUser: (id: string, dto: UpdateUserDto) =>
    http.put<ApiResponse<User>>(`/users/${id}`, dto),

  searchUsers: (params?: SearchUsersParams) =>
    http.get<PaginatedResponse<UserBasic>>('/users', { params }),
}
