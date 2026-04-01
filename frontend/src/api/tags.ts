import http from '@/lib/http'
import type { ApiResponse, Tag, UserTag } from '@/types'

export const tagsApi = {
  getAllTags: () =>
    http.get<ApiResponse<Tag[]>>('/tags'),

  getUserTags: (userId: string) =>
    http.get<ApiResponse<UserTag[]>>(`/user-tags/${userId}`),

  setUserTags: (tagIds: number[]) =>
    http.post<ApiResponse>('/user-tags', { tag_ids: tagIds }),
}
