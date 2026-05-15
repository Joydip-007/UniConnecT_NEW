import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'

function handleGlobalError(error: unknown) {
  // Suppress 4xx client errors (handled per component) and network errors
  // (already toasted by the axios interceptor). Only surface 5xx server errors.
  if (isAxiosError(error) && (!error.response || error.response.status < 500)) return
  toast.error('Something went wrong. Please try again.')
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleGlobalError }),
  mutationCache: new MutationCache({ onError: handleGlobalError }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
