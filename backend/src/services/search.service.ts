import { prisma } from '../config/db.js'

export interface SearchParams {
  query?: string
  userId?: string
  isAdmin?: boolean
  departmentId?: string
  satelliteId?: string
  category?: string
  extension?: string
  classificationLevel?: string
  startDate?: string
  endDate?: string
  sortBy?: 'updatedAt' | 'createdAt' | 'name' | 'sizeBytes'
  sortOrder?: 'asc' | 'desc'
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
  departmentCode: string
  satelliteId: string | null
  satelliteName: string
  satelliteCode: string | null
  hddPath: string
  reportTitle?: string | null
  reportAuthor?: string | null
  reportCategory?: string | null
  customCategory?: string | null
  classificationLevel?: string | null
  versionLabel?: string | null
  createdAt: string
  updatedAt: string
}

export const searchService = {
  async search(params: SearchParams): Promise<{ results: SearchResultItem[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(100, Math.max(1, params.limit || 20))
    const skip = (page - 1) * limit
    const term = (params.query || '').trim()

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

    let cleanTerm = term
    let extractedExtension = params.extension

    // Parse inline search operators like type:pdf or ext:csv or dept:FDD
    if (cleanTerm.includes('type:') || cleanTerm.includes('ext:')) {
      const match = cleanTerm.match(/(?:type|ext):([a-zA-Z0-9]+)/i)
      if (match && match[1]) {
        extractedExtension = match[1].toLowerCase()
        cleanTerm = cleanTerm.replace(/(?:type|ext):[a-zA-Z0-9]+/gi, '').trim()
      }
    }

    if (cleanTerm.includes('dept:')) {
      const deptMatch = cleanTerm.match(/dept:([a-zA-Z0-9_-]+)/i)
      if (deptMatch && deptMatch[1]) {
        cleanTerm = cleanTerm.replace(/dept:[a-zA-Z0-9_-]+/gi, '').trim()
      }
    }

    const whereClause: any = {
      deletedAt: null,
    }

    // Text search condition
    if (cleanTerm) {
      whereClause.OR = [
        { name: { contains: cleanTerm } },
        { description: { contains: cleanTerm } },
        { extension: { contains: cleanTerm } },
        { hddPath: { contains: cleanTerm } },
        { report: { title: { contains: cleanTerm } } },
        { report: { spacecraft: { contains: cleanTerm } } },
        { report: { createdBy: { name: { contains: cleanTerm } } } },
        { department: { name: { contains: cleanTerm } } },
        { department: { code: { contains: cleanTerm } } },
      ]
    }

    // Department filtering
    if (params.departmentId && params.departmentId !== 'ALL') {
      whereClause.departmentId = params.departmentId
    } else if (allowedDeptIds && allowedDeptIds.length > 0) {
      whereClause.departmentId = { in: allowedDeptIds }
    }

    // Satellite / Spacecraft filtering
    if (params.satelliteId && params.satelliteId !== 'ALL') {
      whereClause.department = {
        ...whereClause.department,
        satelliteId: params.satelliteId,
      }
    }

    // Extension / Format filtering
    const effectiveExtension = extractedExtension && extractedExtension !== 'ALL' ? extractedExtension : undefined
    if (effectiveExtension) {
      const ext = effectiveExtension.toLowerCase().replace(/^\./, '')
      if (ext === 'data') {
        whereClause.extension = { in: ['csv', 'dat', 'raw', 'tsv', 'bin'] }
      } else if (ext === 'telemetry') {
        whereClause.extension = { in: ['json', 'xml', 'log', 'yaml', 'yml'] }
      } else if (ext === 'document') {
        whereClause.extension = { in: ['pdf', 'doc', 'docx', 'txt', 'rtf'] }
      } else {
        whereClause.extension = ext
      }
    }

    // Report Category filtering
    if (params.category && params.category !== 'ALL') {
      whereClause.report = {
        ...whereClause.report,
        OR: [
          { category: params.category as any },
          { customCategory: { contains: params.category } },
        ],
      }
    }

    // Classification Level filtering
    if (params.classificationLevel && params.classificationLevel !== 'ALL') {
      whereClause.report = {
        ...whereClause.report,
        classificationLevel: params.classificationLevel as any,
      }
    }

    // Date range filtering
    if (params.startDate || params.endDate) {
      whereClause.createdAt = {}
      if (params.startDate) {
        whereClause.createdAt.gte = new Date(params.startDate)
      }
      if (params.endDate) {
        const end = new Date(params.endDate)
        end.setHours(23, 59, 59, 999)
        whereClause.createdAt.lte = end
      }
    }

    // Sorting
    const sortBy = params.sortBy || 'updatedAt'
    const sortOrder = params.sortOrder || 'desc'
    const orderBy: any = { [sortBy]: sortOrder }

    const [total, files] = await Promise.all([
      prisma.file.count({ where: whereClause }),
      prisma.file.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        include: {
          report: {
            include: {
              createdBy: {
                select: { name: true },
              },
            },
          },
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
      departmentName: f.department?.name || 'TTC Operations Division',
      departmentCode: f.department?.code || 'OPS',
      satelliteId: f.department?.satelliteId || null,
      satelliteName: f.report?.spacecraft || f.department?.satellite?.name || 'ISRO Primary Fleet',
      satelliteCode: f.department?.satellite?.code || null,
      hddPath: f.hddPath || '',
      reportTitle: f.report?.title || null,
      reportAuthor: f.report?.createdBy?.name || null,
      reportCategory: f.report?.category || null,
      customCategory: f.report?.customCategory || null,
      classificationLevel: f.report?.classificationLevel || 'ISRO_LEVEL',
      versionLabel: f.report?.versionLabel || 'V1.0',
      createdAt: f.createdAt ? f.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: f.updatedAt ? f.updatedAt.toISOString() : new Date().toISOString(),
    }))

    return { results, total, page, limit }
  },
}
