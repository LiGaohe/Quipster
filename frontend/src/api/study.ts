import http from '@/lib/http'
import type {
  ApiResponse,
  PaginatedResponse,
  StudyTask,
  CreateStudyTaskDto,
  GetStudyTasksParams,
} from '@/types'

export const studyApi = {
  getTasks: (params?: GetStudyTasksParams) =>
    http.get<PaginatedResponse<StudyTask>>('/study-tasks', { params }),

  createTask: (dto: CreateStudyTaskDto) =>
    http.post<ApiResponse<{ id: string }>>('/study-tasks', dto),

  joinTask: (taskId: string) =>
    http.post<ApiResponse>(`/study-tasks/${taskId}/join`),
}
