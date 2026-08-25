import { useQuery } from '@tanstack/react-query'
import { filesApi, type FileVersion } from '../api'

export type { FileVersion }

export function useFileVersions(fileId: string | null) {
  return useQuery({
    queryKey: ['file-versions', fileId],
    queryFn: async () => {
      if (!fileId) return []
      const res = await filesApi.getFileVersions(fileId)
      return res.map((v) => ({
        id: v.id,
        versionNum: v.versionNum,
        sizeBytes: v.sizeBytes ? Number(v.sizeBytes) : null,
        uploadedBy: v.uploadedBy,
        uploaderName: v.uploadedBy,
        createdAt: v.createdAt,
      }))
    },
    enabled: !!fileId,
  })
}