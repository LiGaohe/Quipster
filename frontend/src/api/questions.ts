import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  Question,
  Answer,
  CreateQuestionDto,
  GetQuestionsParams,
} from '@/types'

export const questionsApi = {
  getQuestions: (params?: GetQuestionsParams) =>
    http.get<PaginatedResponse<Question>>('/questions', { params }),

  createQuestion: (dto: CreateQuestionDto) =>
    http.post<ApiResponse<{ id: string }>>('/questions', dto),

  getAnswers: (questionId: string) =>
    http.get<ApiResponse<Answer[]>>(`/questions/${questionId}/answers`),

  submitAnswer: (questionId: string, content: string) =>
    http.post<ApiResponse<Answer>>(`/questions/${questionId}/answers`, { content }),

  acceptAnswer: (answerId: string) =>
    http.post<ApiResponse>(`/answers/${answerId}/accept`),
}
