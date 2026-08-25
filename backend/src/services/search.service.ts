import { prisma } from '../config/db.js'

export interface SearchParams {
  query: string
  userId: string
  isAdmin: boolean
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

    if (!params.isAdmin) {
      const userAccess = await prisma.userDepartmentAccess.findMany({
        where: { userId: params.userId, deletedAt: null },
        select: { departmentId: true },
      })
      allowedDeptIds = userAccess.map((a: any) => a.departmentId)
      if (!allowedDeptIds || allowedDeptIds.length === 0) {
        return { results: [], total: 0, page, limit }
      }
    }

    const whereClause: any = {
      deletedAt: null,
      status: 'ACTIVE',
      OR: [
        { name: { contains: term } },
        { description: { contains: term } },
      ],
    }

    if (params.departmentId) {
      whereClause.departmentId = params.departmentId
    } else if (allowedDeptIds) {
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
      sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : null,
      departmentId: f.departmentId,
      departmentName: f.department.name,
      satelliteName: f.department.satellite.name,
      hddPath: f.hddPath,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }))

    return { results, total, page, limit }
  },
}
