import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { filesApi } from '../api'
import { splitIntoChunks } from '../lib/fileUpload'
import { sanitizeFilename } from '../lib/sanitize'
import { type UploadItem, CHUNK_THRESHOLD, CHUNK_SIZE } from '../types/upload'

interface UseFileUploadParams {
  departmentId: string
  parentId: string | null
}

export function useFileUpload({ departmentId, parentId }: UseFileUploadParams) {
  const [items, setItems] = useState<UploadItem[]>([])
  const queryClient = useQueryClient()

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  async function uploadSingleShot(item: UploadItem) {
    await filesApi.uploadSingle(
      item.file,
      departmentId,
      parentId,
      (pct) => updateItem(item.id, { progress: pct })
    )
  }

  async function uploadChunked(item: UploadItem) {
    updateItem(item.id, { status: 'uploading' })

    const chunks = splitIntoChunks(item.file, CHUNK_SIZE)
    const safeName = sanitizeFilename(item.file.name)

    // Sequential chunk transmission
    for (let i = 0; i < chunks.length; i++) {
      await filesApi.uploadChunk(chunks[i], safeName, i, chunks.length, departmentId)
      const pct = Math.round(((i + 1) / chunks.length) * 100)
      updateItem(item.id, { progress: pct })
    }

    await filesApi.completeChunkUpload({
      fileName: safeName,
      departmentId,
      parentId,
      totalChunks: chunks.length,
    })
  }

  const uploadFile = useCallback(
    async (item: UploadItem) => {
      try {
        if (item.file.size > CHUNK_THRESHOLD) {
          await uploadChunked(item)
        } else {
          await uploadSingleShot(item)
        }
        updateItem(item.id, { status: 'complete', progress: 100 })
        queryClient.invalidateQueries({ queryKey: ['dept-files'] })
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
      } catch (err: any) {
        updateItem(item.id, { status: 'error', error: err?.response?.data?.error?.message || 'Upload failed' })
      }
    },
    [departmentId, parentId, queryClient]
  )

  function addFiles(files: FileList | File[]) {
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      progress: 0,
    }))
    setItems((prev) => [...prev, ...newItems])
    newItems.forEach((item) => uploadFile(item))
  }

  function reset() {
    setItems([])
  }

  return { items, addFiles, reset }
}