import { prisma } from '../config/db.js'

/** The file a FILE_UPLOAD notification is about (stored as resourceId, and as metadata.fileId). */
export function notificationFileId(n: { resourceId?: string | null; metadata?: unknown }): string | null {
  if (n.resourceId) return n.resourceId
  let meta: any = n.metadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      meta = null
    }
  }
  return meta && typeof meta.fileId === 'string' ? meta.fileId : null
}

/**
 * Of the given file ids, the ones a signed-out visitor may learn about: featured (public) files
 * that are not deleted and sit in an active, non-deleted department. Upload notifications for any
 * other file stay private, since their text names the uploader, the file and the division.
 */
export async function publicFileIds(ids: (string | null)[]): Promise<Set<string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) return new Set()
  const rows = await prisma.file.findMany({
    where: { id: { in: wanted }, isFeatured: true, deletedAt: null, department: { isActive: true, deletedAt: null } },
    select: { id: true },
  })
  return new Set(rows.map((r: { id: string }) => r.id))
}
