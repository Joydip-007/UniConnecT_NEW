import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateProblemReportInput,
  ProblemReport,
  ProblemReportStatus,
} from '@uniconnect/shared'
import { api } from '@/lib/axios'

export interface ProblemReportPage {
  items: ProblemReport[]
  total: number
  page: number
  hasMore: boolean
}

const ADMIN_KEY = ['admin', 'problem-reports'] as const

/** Member side: file the crash the "This page didn't load" card caught. */
export function useSubmitProblemReport() {
  return useMutation({
    mutationFn: (input: CreateProblemReportInput) =>
      api.post<{ data: ProblemReport }>('/users/me/problem-reports', input).then((r) => r.data.data),
  })
}

export function useAdminProblemReports(page: number, limit = 20) {
  return useQuery({
    queryKey: [...ADMIN_KEY, { page, limit }],
    queryFn: () =>
      api
        .get<{ data: ProblemReportPage }>(`/admin/problem-reports?page=${page}&limit=${limit}`)
        .then((r) => r.data.data),
  })
}

export function useSetProblemReportStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProblemReportStatus }) =>
      api.patch(`/admin/problem-reports/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ADMIN_KEY })
    },
  })
}
