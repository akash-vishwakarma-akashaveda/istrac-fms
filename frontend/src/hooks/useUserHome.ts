import { useQuery } from '@tanstack/react-query'
import { departmentsApi, browseApi, usersApi } from '../api'

export interface UserDeptCard {
  id: string
  name: string
  fileCount: number
  lastUpdated: string
}

export interface RecentFile {
  id: string
  name: string
  departmentName: string
  uploadedAt: string
  mimeType: string | null
  size: number
}

export function useUserDepartments() {
  return useQuery({
    queryKey: ['user-departments'],
    queryFn: async () => {
      const depts = await departmentsApi.getUserDepartments()
      return depts.map((d) => ({
        id: d.id,
        name: d.name,
        fileCount: d.fileCount || 0,
        lastUpdated: d.updatedAt || d.createdAt,
      }))
    },
  })
}

export function useRecentFiles() {
  return useQuery({
    queryKey: ['recent-files'],
    queryFn: async () => {
      try {
        const res = await browseApi.search('', undefined, 1, 10)
        return (res.data || []).map((f) => ({
          id: f.id,
          name: f.name,
          departmentName: f.departmentName,
          uploadedAt: f.createdAt,
          mimeType: f.mimeType || null,
          size: f.sizeBytes ? Number(f.sizeBytes) : 0,
        }))
      } catch {
        return []
      }
    },
  })
}

export function useMissionOverview() {
  return useQuery({
    queryKey: ['mission-overview'],
    queryFn: async () => {
      return await usersApi.getMissionOverview()
    },
    staleTime: 30000,
  })
}