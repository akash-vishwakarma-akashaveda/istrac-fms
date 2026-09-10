import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { filesApi } from '../api/files.api'
import { formatFileSize } from '../lib/formatFileSize'

export interface FeaturedReportItem {
  id: string
  title: string
  filename: string
  department: string
  departmentName?: string
  departmentCode?: string
  departmentId?: string
  satellite: string
  fileSize: string
  extension: string
  mimeType?: string | null
  date: string
  classification?: string
  description?: string
  isFeatured?: boolean
  versionCount?: number
  versionLabel?: string
}

export const FEATURED_REPORTS_QUERY_KEY = ['featured-reports'] as const

export function useFeaturedReports() {
  return useQuery<FeaturedReportItem[]>({
    queryKey: FEATURED_REPORTS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get('/files/featured-list')
      if (res.data?.data && res.data.data.length > 0) {
        return res.data.data.map((f: any) => ({
          id: f.id,
          title: f.title || f.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          filename: f.filename || f.name,
          department: f.department || f.departmentCode || 'TTC',
          departmentName: f.departmentName,
          departmentCode: f.departmentCode,
          departmentId: f.departmentId,
          satellite: f.satellite || 'Primary Fleet',
          fileSize: formatFileSize(Number(f.sizeBytes) || 0),
          extension: (f.extension || 'DAT').toUpperCase(),
          mimeType: f.mimeType || null,
          date: f.date || (f.createdAt ? f.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
          classification: f.classification || 'RESTRICTED',
          description: f.description || `Official telemetry archive and observation report for ${f.satellite || f.department}.`,
          isFeatured: Boolean(f.isFeatured),
        }))
      }
      return []
    },
    staleTime: 1000 * 60 * 2, // 2 minutes fresh
  })
}

export function useToggleFeatureFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ fileId, isFeatured }: { fileId: string; isFeatured: boolean }) =>
      filesApi.toggleFeature(fileId, isFeatured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEATURED_REPORTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['dept-files'] })
    },
  })
}
