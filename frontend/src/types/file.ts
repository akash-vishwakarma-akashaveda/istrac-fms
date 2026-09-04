export interface FileNode {
  id: string
  name: string
  nodeType: 'FOLDER' | 'FILE'
  departmentId: string
  parentId: string | null
  sizeBytes: number | null
  mimeType: string | null
  status: 'ACTIVE' | 'ORPHANED' | 'DELETED' | 'UNREGISTERED'
  createdAt: string
  versionCount?: number
  versionLabel?: string | null
  title?: string | null
  description?: string | null
  isFeatured?: boolean
  spacecraft?: string | null
  category?: string | null
}

export type SortField = 'name' | 'createdAt' | 'sizeBytes'
export type SortDirection = 'asc' | 'desc'