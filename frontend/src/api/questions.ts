import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  Question,
  Answer,
  AiAnswer,
  CreateQuestionDto,
  GetQuestionsParams,
} from '@/types'

export const questionsApi = {
  getQuestions: (params?: GetQuestionsParams) =>
    http.get<PaginatedResponse<Question>>('/questions', { params }),

  getQuestion: (id: string) =>
    http.get<ApiResponse<Question>>(`/questions/${id}`),

  createQuestion: (dto: CreateQuestionDto) =>
    http.post<ApiResponse<{ id: string }>>('/questions', dto),

  getAnswers: (questionId: string) =>
    http.get<ApiResponse<Answer[]>>(`/questions/${questionId}/answers`),

  getAiAnswer: (questionId: string) =>
    http.get<ApiResponse<AiAnswer | null>>(`/questions/${questionId}/ai-answer`),

  generateAiAnswer: (questionId: string, force = false) =>
    http.post<ApiResponse<AiAnswer>>(`/questions/${questionId}/ai-answer${force ? '?force=true' : ''}`),

  submitAnswer: (questionId: string, content: string) =>
    http.post<ApiResponse<Answer>>(`/questions/${questionId}/answers`, { content }),

  acceptAnswer: (answerId: string) =>
    http.post<ApiResponse>(`/answers/${answerId}/accept`),
}
