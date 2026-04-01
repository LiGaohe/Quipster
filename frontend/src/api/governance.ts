import http from '@/lib/http'
import type { ApiResponse, ReportDto, CreditInfo } from '@/types'

export const governanceApi = {
  report: (dto: ReportDto) =>
    http.post<ApiResponse>('/reports', dto),

  getCredit: () =>
    http.get<ApiResponse<CreditInfo>>('/credit'),
}
