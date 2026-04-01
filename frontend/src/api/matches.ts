import http from '@/lib/http'
import type {
  ApiResponse,
  MatchUser,
  MatchActionDto,
  MatchActionResponse,
} from '@/types'

export const matchesApi = {
  getMatches: (params?: { page?: number; limit?: number }) =>
    http.get<ApiResponse<MatchUser[]>>('/matches', { params }),

  recordAction: (dto: MatchActionDto) =>
    http.post<MatchActionResponse>('/matches', dto),
}
