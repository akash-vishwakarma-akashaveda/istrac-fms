import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { browseApi, filesApi } from '../api'
import type { FileNode, SortField, SortDirection } from '../types/file'

interface UseDeptFilesParams {
  deptId: string
  parentId: string | null
  sortField: SortField
  sortDirection: SortDirection
}

export function useDeptFiles({ deptId, parentId, sortField, sortDirection }: UseDeptFilesParams) {
  return useQuery({
    queryKey: ['dept-files', deptId, parentId],
    queryFn: async () => {
      const res = await browseApi.getDepartmentFiles(deptId, { parentId })
      const rawData = res.data || (res as any) || []
      const fileNodes: FileNode[] = Array.isArray(rawData)
        ? rawData.map((f: any) => ({
            id: f.id,
            name: f.name,
            nodeType: f.nodeType as 'FILE' | 'FOLDER',
            departmentId: deptId,
            parentId: parentId,
            mimeType: f.mimeType || null,
            sizeBytes: f.sizeBytes ? Number(f.sizeBytes) : null,
            status: 'ACTIVE' as const,
            createdAt: f.createdAt,
            versionCount: f.versionCount || 1,
            isFeatured: Boolean(f.isFeatured),
            spacecraft: f.spacecraft ? (String(f.spacecraft).includes('General') ? 'General' : f.spacecraft) : null,
            category: f.category || null,
            tags: Array.isArray(f.tags) ? f.tags : [],
          }))
        : []
      return fileNodes
    },
    select: (data) =>
      [...data].sort((a, b) => {
        const dir = sortDirection === 'asc' ? 1 : -1
        if (sortField === 'name') return a.name.localeCompare(b.name) * dir
        if (sortField === 'sizeBytes') return ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0)) * dir
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
      }),
    enabled: !!deptId,
  })
}

export function useBulkDeleteFiles() {
  const queryClient = useQueryClient()
  return useMutation({
    // allSettled so one failure doesn't hide which files were actually moved.
    mutationFn: async (fileIds: string[]) => {
      const results = await Promise.allSettled(fileIds.map((id) => filesApi.deleteFile(id)))
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      return { moved: fileIds.length - failed.length, failed: failed.length, firstError: failed[0]?.reason }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dept-files'] }),
  })
}

export function useBulkTagFiles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ fileIds, tags }: { fileIds: string[]; tags: string[] }) => filesApi.tagFiles(fileIds, tags),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dept-files'] }),
  })
}