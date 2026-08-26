import { prisma } from '../config/db.js'

export interface SearchParams {
  query: string
  userId?: string
  isAdmin?: boolean
  departmentId?: string
  page?: number
  limit?: number
}

export interface SearchResultItem {
  id: string
  name: string
  nodeType: string
  mimeType: string | null
  extension: string | null
  sizeBytes: string | null
  departmentId: string
  departmentName: string
  satelliteName: string
  hddPath: string
  createdAt: string
  updatedAt: string
}

export const searchService = {
  async search(params: SearchParams): Promise<{ results: SearchResultItem[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(100, Math.max(1, params.limit || 20))
    const skip = (page - 1) * limit
    const term = params.query.trim()

    if (!term) {
      return { results: [], total: 0, page, limit }
    }

    let allowedDeptIds: string[] | undefined

    // If logged in as non-admin and has explicit department ACL restrictions
    if (params.userId && !params.isAdmin) {
      const userAccess = await prisma.userDepartmentAccess.findMany({
        where: { userId: params.userId, deletedAt: null },
        select: { departmentId: true },
      })
      if (userAccess.length > 0) {
        allowedDeptIds = userAccess.map((a: any) => a.departmentId)
      }
    }

    const whereClause: any = {
      deletedAt: null,
      OR: [
        { name: { contains: term } },
        { description: { contains: term } },
        { extension: { contains: term } },
        { hddPath: { contains: term } },
        { report: { title: { contains: term } } },
        { report: { spacecraft: { contains: term } } },
        { department: { name: { contains: term } } },
        { department: { code: { contains: term } } },
      ],
    }

    if (params.departmentId) {
      whereClause.departmentId = params.departmentId
    } else if (allowedDeptIds && allowedDeptIds.length > 0) {
      whereClause.departmentId = { in: allowedDeptIds }
    }

    const [total, files] = await Promise.all([
      prisma.file.count({ where: whereClause }),
      prisma.file.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          report: true,
          department: {
            include: { satellite: true },
          },
        },
      }),
    ])

    const results: SearchResultItem[] = files.map((f: any) => ({
      id: f.id,
      name: f.name,
      nodeType: f.nodeType,
      mimeType: f.mimeType,
      extension: f.extension,
      sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : '0',
      departmentId: f.departmentId,
      departmentName: f.department?.name || 'TTC Division',
      satelliteName: f.report?.spacecraft || f.department?.satellite?.name || 'ISRO Primary Fleet',
      hddPath: f.hddPath || '',
      createdAt: f.createdAt ? f.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: f.updatedAt ? f.updatedAt.toISOString() : new Date().toISOString(),
    }))

    return { results, total, page, limit }
  },
}
