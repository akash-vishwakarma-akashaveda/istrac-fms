import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { filesApi } from '../api'
import { splitIntoChunks } from '../lib/fileUpload'
import { sanitizeFilename } from '../lib/sanitize'
import { type UploadItem, CHUNK_THRESHOLD, CHUNK_SIZE } from '../types/upload'
import { useToastStore } from '../store/toastStore'

interface UseFileUploadParams {
  departmentId: string
  parentId: string | null
}
const MAX_FILE_SIZE = 500 * 1024 * 1024
const FORBIDDEN_EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'com', 'pif', 'scr', 'cpl', 'msc', 'msi', 'msp',
  'bat', 'cmd', 'vbs', 'vbe', 'jse', 'wsf', 'wsh', 'ps1', 'ps2', 'psc1', 'psc2',
  'php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'asp', 'aspx', 'jsp', 'jspx', 'cgi', 'pl',
  'lnk', 'inf', 'reg', 'hta',
])
export function useFileUpload({ departmentId, parentId }: UseFileUploadParams) {
  const [items, setItems] = useState<UploadItem[]>([])
  const queryClient = useQueryClient()
  const {addToast} =  useToastStore()
  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  async function uploadSingleShot(item: UploadItem) {
      const safeName = sanitizeFilename(item.file.name)
      const safeFile =
    safeName !== item.file.name
      ? new File([item.file], safeName, {
          type: item.file.type,
          lastModified: item.file.lastModified,
        })
      : item.file
    await filesApi.uploadSingle(
      safeFile,
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
  const valid: File[] = []
  const rejected: string[] = []

  for (const file of Array.from(files)) {
    const extension = file.name
      .split('.')
      .pop()
      ?.toLowerCase()

    if (extension && FORBIDDEN_EXECUTABLE_EXTENSIONS.has(extension)) {
      rejected.push(`${file.name} (Executable files prohibited)`)
      continue
    }
      if (file.size > MAX_FILE_SIZE) {
      addToast({ variant: 'error', message: `${file.name} exceeds the 500MB file size limit` })
      continue
    }

    valid.push(file)
  }

  // Show rejected files
  if (rejected.length > 0) {
    addToast({
      variant: 'error',
      message: `File type not permitted: ${rejected.join(', ')}`,
    })
  }

  // Don't create upload items for rejected files
  const newItems: UploadItem[] = valid.map((file) => ({
    id: crypto.randomUUID(),
    file,
    status: 'queued',
    progress: 0,
  }))

 if (newItems.length > 0) {
  setItems((prev) => [...prev, ...newItems])

  newItems.forEach((item) => {
    uploadFile(item)
  })
}
}

  function reset() {
    setItems([])
  }

  return { items, addFiles, reset }
}