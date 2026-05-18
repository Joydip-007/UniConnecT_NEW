import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/stores/authStore'

export function useMentorshipOptIn() {
  const updateProfile = useAuthStore((s) => s.updateProfile)

  return useMutation({
    mutationFn: (next: boolean) =>
      api
        .patch('/users/me', { isOpenToMentorship: next })
        .then((r) => r.data.data as { profile: { isOpenToMentorship: boolean } }),
    onMutate: (next) => {
      updateProfile({ isOpenToMentorship: next })
      return { next }
    },
    onError: (_err, _next, context) => {
      if (context) updateProfile({ isOpenToMentorship: !context.next })
    },
  })
}
