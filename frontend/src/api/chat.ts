import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  Conversation,
  Message,
  SendMessageDto,
  GetMessagesParams,
} from '@/types'

export const chatApi = {
  getConversations: () =>
    http.get<ApiResponse<Conversation[]>>('/conversations'),

  getMessages: (conversationId: string, params?: GetMessagesParams) =>
    http.get<PaginatedResponse<Message>>(`/conversations/${conversationId}/messages`, { params }),

  sendMessage: (dto: SendMessageDto) =>
    http.post<ApiResponse<Message>>('/messages', dto),
}
