import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import type { BulkInviteResult, CourseOutlineDraft, CourseOutlineDraftResponse, Group } from '../types'

export function useOutlineDraft() {
  return useMutation({
    mutationFn: (input: { fileUrl: string; rosterUrl?: string }) =>
      api
        .post<{ data: CourseOutlineDraftResponse }>('/groups/course-outline/draft', {
          file_url: input.fileUrl,
          roster_url: input.rosterUrl,
        })
        .then((r) => r.data.data),
  })
}

export function useCreateGroupFromOutline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; section?: string; draft: CourseOutlineDraft; is_private: boolean }) =>
      api.post<{ data: Group }>('/groups/from-outline', input).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['groups', 'my'] })
    },
  })
}

/** Matches the department/batch pair against `profiles` — used to preview the bulk-invite
 *  count before sending it. Disabled until at least one filter is set. */
export function useInviteMatch(department: string, batchYear: number | null) {
  return useQuery({
    queryKey: ['groups', 'invite-match', { department, batchYear }] as const,
    queryFn: () =>
      api
        .get<{ data: { count: number } }>('/groups/invite-match', {
          params: {
            department: department.trim() || undefined,
            batch_year: batchYear ?? undefined,
          },
        })
        .then((r) => r.data.data),
    enabled: Boolean(department.trim()) || batchYear != null,
  })
}

export function useBulkInvite(groupId: string) {
  return useMutation({
    mutationFn: (input: { department?: string; batch_year?: number; emails?: string[] }) =>
      api
        .post<{ data: BulkInviteResult }>(`/groups/${groupId}/invitations/bulk`, input)
        .then((r) => r.data.data),
  })
}
