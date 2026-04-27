import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  Group,
  GroupMember,
  CreateGroupDto,
  UpdateGroupDto,
} from '@/types'

export const groupsApi = {
  getGroups: (params?: { keyword?: string; page?: number; limit?: number }) =>
    http.get<PaginatedResponse<Group>>('/groups', { params }),

  getGroupById: (groupId: string | number) =>
    http.get<ApiResponse<Group>>(`/groups/${groupId}`),

  createGroup: (dto: CreateGroupDto) =>
    http.post<ApiResponse<{ id: string }>>('/groups', dto),

  updateGroup: (groupId: string | number, dto: UpdateGroupDto) =>
    http.put<ApiResponse>(`/groups/${groupId}`, dto),

  joinGroup: (groupId: string | number) =>
    http.post<ApiResponse>(`/groups/${groupId}/join`),

  leaveGroup: (groupId: string | number) =>
    http.post<ApiResponse>(`/groups/${groupId}/leave`),

  getGroupChat: (groupId: string | number) =>
    http.get<ApiResponse<{ conversation_id: string | number }>>(`/groups/${groupId}/chat`),

  getGroupMembers: (groupId: string | number, params?: { page?: number; limit?: number }) =>
    http.get<PaginatedResponse<GroupMember>>(`/groups/${groupId}/members`, { params }),
}
