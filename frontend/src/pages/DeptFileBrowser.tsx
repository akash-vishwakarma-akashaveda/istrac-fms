import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import {
  useFolderTree,
  type TreeNode,
} from '../hooks/useFolderTree'
import { useDepartments } from '../hooks/useDepartments'

import { FolderTree } from '../components/FolderTree'
import { DeptBreadcrumb } from '../components/DeptBreadcrumb'
import { FileBrowser } from '../components/FileBrowser'

/**
 * Walks the folder tree and returns the path from the root
 * to the requested folder.
 *
 * Used to build the breadcrumb navigation.
 */
function findPath(
  nodes: TreeNode[],
  targetId: string,
  trail: TreeNode[] = [],
): TreeNode[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [...trail, node]
    }

    const found = findPath(
      node.children,
      targetId,
      [...trail, node],
    )

    if (found) {
      return found
    }
  }

  return null
}

export function DeptFileBrowser() {
  const { deptId } = useParams<{ deptId: string }>()

  const [currentFolderId, setCurrentFolderId] =
    useState<string | null>(null)

  const { data: departments } = useDepartments()

  const {
    data: tree,
    isLoading,
  } = useFolderTree(deptId ?? '')

  const department = departments?.find(
    (dept) => dept.id === deptId,
  )

  const breadcrumbPath = useMemo(() => {
    if (!tree || !currentFolderId) {
      return []
    }

    const path = findPath(tree, currentFolderId)

    return (
      path?.map((node) => ({
        id: node.id,
        name: node.name,
      })) ?? []
    )
  }, [tree, currentFolderId])

  if (!deptId) {
    return (
      <div className="rounded-xl border border-border-subtle bg-card p-10 text-center shadow-card">
        <p className="num text-sm text-text-dim">—</p>
        <p className="mt-2 text-[13px] text-text-muted">No department selected.</p>
      </div>
    )
  }

  function handleFolderNavigate(folderId: string | null) {
    setCurrentFolderId(folderId)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
      {/* Folder navigation */}
      <aside className="overflow-hidden rounded-xl border border-border-subtle bg-card shadow-card lg:sticky lg:top-0 lg:self-start">
        <header className="border-b border-border-subtle px-3 py-2.5">
          <h3 className="eyebrow text-text-secondary">Folders</h3>
        </header>

        <div className="py-2 pr-2">
          {isLoading ? (
            <p className="num px-3 py-1 text-xs text-text-dim">Loading…</p>
          ) : !tree || tree.length === 0 ? (
            <p className="px-3 py-1 text-xs text-text-dim">No folders yet. Files are shown at the top level.</p>
          ) : (
            <FolderTree
              nodes={tree ?? []}
              activeFolderId={currentFolderId}
              onSelect={handleFolderNavigate}
            />
          )}
        </div>
      </aside>

      {/* File browser */}
      <main className="min-w-0 space-y-4">
        <DeptBreadcrumb
          deptName={department?.name ?? 'Department'}
          path={breadcrumbPath}
          onNavigate={handleFolderNavigate}
        />

        <FileBrowser
          deptId={deptId}
          parentId={currentFolderId}
        />
      </main>
    </div>
  )
}