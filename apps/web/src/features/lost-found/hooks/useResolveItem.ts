import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/axios'

export function useResolveItem(itemId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch(`/lost-found/${itemId}/resolve`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-found', 'list'] })
      toast.success('Item marked as resolved')
    },
    onError: () => {
      toast.error('Failed to update item')
    },
  })
}
