import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  AnonymousPost,
  AnonymousComment,
  AnonymousSupportInfo,
  CreateAnonymousPostDto,
  GetAnonymousPostsParams,
} from '@/types'

export const anonymousApi = {
  getPosts: (params?: GetAnonymousPostsParams) =>
    http.get<PaginatedResponse<AnonymousPost>>('/anonymous-posts', { params }),

  getPost: (postId: string) =>
    http.get<ApiResponse<AnonymousPost>>(`/anonymous-posts/${postId}`),

  getComments: (postId: string) =>
    http.get<ApiResponse<AnonymousComment[]>>(`/anonymous-posts/${postId}/comments`),

  getSupportInfo: (postId: string) =>
    http.get<ApiResponse<AnonymousSupportInfo>>(`/anonymous-posts/${postId}/support`),

  createPost: (dto: CreateAnonymousPostDto) =>
    http.post<ApiResponse<{ id: string }>>('/anonymous-posts', dto),

  analyzeEmotion: (postId: string) =>
    http.post<ApiResponse<AnonymousSupportInfo>>(`/anonymous-posts/${postId}/analyze-emotion`),

  likePost: (postId: string) =>
    http.post<{ success: boolean; is_liked: boolean; like_count: number }>(`/anonymous-posts/${postId}/like`),

  commentPost: (postId: string, content: string) =>
    http.post<ApiResponse<AnonymousComment>>(`/anonymous-posts/${postId}/comment`, { content }),
}
