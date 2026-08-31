import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cmsApi } from '../api'

/**
 * Broadcasts a CMS block update to all preview iframes via postMessage.
 * The iframe's Landing page listens and calls refetch() to pull the updated
 * block immediately — no full page reload required.
 */
function broadcastToPreviewIframes(blockKey: string, content: Record<string, unknown>) {
  try {
    const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[title="Landing page preview"]')
    iframes.forEach((iframe) => {
      iframe.contentWindow?.postMessage(
        { type: 'CMS_BLOCK_UPDATE', blockKey, content },
        window.location.origin,
      )
    })
  } catch {
    // Silently ignore cross-origin or unavailable iframe errors
  }
}

export function useUpdateCmsBlock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ blockKey, content }: { blockKey: string; content: Record<string, unknown> }) =>
      cmsApi.updateBlock(blockKey, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cms'] })
      // Push update directly into the live preview iframe — instant, no reload
      broadcastToPreviewIframes(variables.blockKey, variables.content)
    },
  })
}