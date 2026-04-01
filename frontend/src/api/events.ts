import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  Event,
  CreateEventDto,
  GetEventsParams,
} from '@/types'

export const eventsApi = {
  getEvents: (params?: GetEventsParams) =>
    http.get<PaginatedResponse<Event>>('/events', { params }),

  createEvent: (dto: CreateEventDto) =>
    http.post<ApiResponse<{ id: string }>>('/events', dto),

  signupEvent: (eventId: string) =>
    http.post<ApiResponse>(`/events/${eventId}/signup`),
}
