import { useQuery } from '@tanstack/react-query'
import { browseApi } from '../api'
import { sanitizeSearchQuery } from '../lib/sanitize'
import type { FileNode } from '../types/file'

export function useSearch(query: string, departmentId?: string) {
  const sanitized = sanitizeSearchQuery(query)

  return useQuery({
    queryKey: ['search', sanitized, departmentId],
    queryFn: async () => {
      const res = await browseApi.search(sanitized, departmentId)
      const list = res.data || []
      const fileNodes: FileNode[] = list.map((item) => ({
        id: item.id,
        name: item.name,
        nodeType: (item.nodeType as 'FILE' | 'FOLDER') || 'FILE',
        departmentId: item.departmentId || '',
        parentId: null,
        mimeType: item.mimeType || null,
        sizeBytes: item.sizeBytes ? Number(item.sizeBytes) : null,
        status: 'ACTIVE' as const,
        createdAt: item.createdAt,
        versionCount: 1,
      }))
      return fileNodes
    },
    enabled: sanitized.length > 0,
  })
}