import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  AnonymousPost,
  AnonymousComment,
  CreateAnonymousPostDto,
  GetAnonymousPostsParams,
} from '@/types'

export const anonymousApi = {
  getPosts: (params?: GetAnonymousPostsParams) =>
    http.get<PaginatedResponse<AnonymousPost>>('/anonymous-posts', { params }),

  createPost: (dto: CreateAnonymousPostDto) =>
    http.post<ApiResponse<{ id: string }>>('/anonymous-posts', dto),

  likePost: (postId: string) =>
    http.post<{ success: boolean; is_liked: boolean; like_count: number }>(`/anonymous-posts/${postId}/like`),

  commentPost: (postId: string, content: string) =>
    http.post<ApiResponse<AnonymousComment>>(`/anonymous-posts/${postId}/comment`, { content }),
}
