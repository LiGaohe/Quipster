import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  Group,
  CreateGroupDto,
} from '@/types'

export const groupsApi = {
  getGroups: (params?: { keyword?: string; page?: number; limit?: number }) =>
    http.get<PaginatedResponse<Group>>('/groups', { params }),

  getGroupById: (groupId: string) =>
    http.get<ApiResponse<Group>>(`/groups/${groupId}`),

  createGroup: (dto: CreateGroupDto) =>
    http.post<ApiResponse<{ id: string }>>('/groups', dto),

  joinGroup: (groupId: string) =>
    http.post<ApiResponse>(`/groups/${groupId}/join`),

  leaveGroup: (groupId: string) =>
    http.post<ApiResponse>(`/groups/${groupId}/leave`),
}
