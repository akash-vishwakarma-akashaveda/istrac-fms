import { useQuery } from '@tanstack/react-query'
import { browseApi } from '../api'
import type { FileNode } from '../types/file'

export interface TreeNode extends Partial<FileNode> {
  id: string
  name: string
  parentId: string | null
  children: TreeNode[]
}

export function useFolderTree(deptId: string) {
  return useQuery({
    queryKey: ['folder-tree', deptId],
    queryFn: async () => {
      const tree = await browseApi.getDepartmentTree(deptId)
      return tree as unknown as TreeNode[]
    },
    enabled: !!deptId,
  })
}