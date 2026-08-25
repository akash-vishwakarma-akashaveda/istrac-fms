import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cmsApi } from '../api'

export function useUpdateCmsBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ blockKey, content }: { blockKey: string; content: Record<string, unknown> }) =>
      cmsApi.updateBlock(blockKey, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cms'] })
    },
  })
}