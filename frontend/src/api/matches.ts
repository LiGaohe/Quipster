import http from '@/lib/http'
import type {
  ApiResponse,
  MatchUser,
  MatchActionDto,
  MatchActionResponse,
  IcebreakerSuggestion,
} from '@/types'

export const matchesApi = {
  getMatches: (params?: { page?: number; limit?: number }) =>
    http.get<ApiResponse<MatchUser[]>>('/matches', { params }),

  recordAction: (dto: MatchActionDto) =>
    http.post<MatchActionResponse>('/matches', dto),

  getIcebreaker: (peerUserId: string) =>
    http.get<ApiResponse<IcebreakerSuggestion>>('/matches/icebreaker', {
      params: { peer_user_id: peerUserId },
      timeout: 60000,
    }),
}
