import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  Post,
  Comment,
  CreatePostDto,
  GetPostsParams,
} from '@/types'

export const postsApi = {
  getPosts: (params?: GetPostsParams) =>
    http.get<PaginatedResponse<Post>>('/posts', { params }),

  createPost: (dto: CreatePostDto) =>
    http.post<ApiResponse<Post>>('/posts', dto),

  likePost: (postId: string) =>
    http.post<{ success: boolean; is_liked: boolean; like_count: number }>(`/posts/${postId}/like`),

  commentPost: (postId: string, content: string) =>
    http.post<ApiResponse<Comment>>(`/posts/${postId}/comment`, { content }),

  getComments: (postId: string) =>
    http.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`),
}
