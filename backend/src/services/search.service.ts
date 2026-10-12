import { prisma } from "../config/db.js"
import { categoryCodeOf, reportCategoryWhere } from '../lib/reportCategory.js'

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
  sortBy?: "updatedAt" | "createdAt" | "name" | "sizeBytes"
  sortOrder?: "asc" | "desc"
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
  departmentIsActive: boolean
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
  isFeatured?: boolean
  createdAt: string
  updatedAt: string
}

export const searchService = {
  async search(params: SearchParams): Promise<{ results: SearchResultItem[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.min(100, Math.max(1, params.limit || 20))
    const skip = (page - 1) * limit
    const term = (params.query || "").trim()

    let allowedDeptIds: string[] | undefined

    // ACCESS CONTROL:
    // If not admin and user is logged in, restrict search strictly to the user's assigned departments (or preferred department)
    if (params.userId && !params.isAdmin) {
      const userAccess = await prisma.userDepartmentAccess.findMany({
        where: {
          userId: params.userId,
          deletedAt: null,
          department: {
            isActive: true,
            deletedAt: null,
          },
        },
        select: { departmentId: true },
      })

      // Only departments an administrator has granted. (The self-chosen registration
      // preference must not grant anything.)
      allowedDeptIds = userAccess.map((a: any) => a.departmentId)

      // If member has no assigned department access at all, return empty results
      if (!allowedDeptIds || allowedDeptIds.length === 0) {
        return { results: [], total: 0, page, limit }
      }
    }

    let cleanTerm = term
    let extractedExtension = params.extension

    // Parse inline search operators like type:pdf or ext:csv or dept:FDD
    if (cleanTerm.includes("type:") || cleanTerm.includes("ext:")) {
      const match = cleanTerm.match(/(?:type|ext):([a-zA-Z0-9]+)/i)
      if (match && match[1]) {
        extractedExtension = match[1].toLowerCase()
        cleanTerm = cleanTerm.replace(/(?:type|ext):[a-zA-Z0-9]+/gi, "").trim()
      }
    }

    // dept:FDD narrows to one department (by code); previously parsed but never applied.
    let departmentFilter = params.departmentId
    if (cleanTerm.includes("dept:")) {
      const deptMatch = cleanTerm.match(/dept:([a-zA-Z0-9_-]+)/i)
      if (deptMatch && deptMatch[1]) {
        cleanTerm = cleanTerm.replace(/dept:[a-zA-Z0-9_-]+/gi, "").trim()
        if (!departmentFilter || departmentFilter === "ALL") {
          const byCode = await prisma.department.findFirst({ where: { code: deptMatch[1], deletedAt: null }, select: { id: true } })
          if (!byCode) return { results: [], total: 0, page, limit }
          departmentFilter = byCode.id
        }
      }
    }

    const whereClause: any = {
      deletedAt: null,
      status: { in: ["ACTIVE", "ORPHANED"] },
      nodeType: "FILE",
    }

    // Anonymous visitors only see the public showcase: featured files in active departments
    // (the same rule the download route applies).
    if (!params.userId) {
      whereClause.isFeatured = true
      whereClause.department = { isActive: true, deletedAt: null }
    }

    // Text search condition
    if (cleanTerm) {
      whereClause.OR = [
        { name: { contains: cleanTerm } },
        { description: { contains: cleanTerm } },
        { extension: { contains: cleanTerm } },
        // Server paths are internal: only administrators may search by them.
        ...(params.isAdmin ? [{ hddPath: { contains: cleanTerm } }] : []),
        { report: { title: { contains: cleanTerm } } },
        { report: { spacecraft: { contains: cleanTerm } } },
        { report: { createdBy: { name: { contains: cleanTerm } } } },
        { department: { name: { contains: cleanTerm } } },
        { department: { code: { contains: cleanTerm } } },
      ]
    }

    // Department filtering (Admin can choose ANY department; Member is constrained by their allowedDeptIds)
    if (departmentFilter && departmentFilter !== "ALL") {
      if (allowedDeptIds && !allowedDeptIds.includes(departmentFilter)) {
        // User requested a department they don't have access to
        return { results: [], total: 0, page, limit }
      }
      whereClause.departmentId = departmentFilter
    } else if (allowedDeptIds && allowedDeptIds.length > 0) {
      whereClause.departmentId = { in: allowedDeptIds }
    }

    // Satellite / Spacecraft filtering
    if (params.satelliteId && params.satelliteId !== "ALL") {
      whereClause.department = {
        ...whereClause.department,
        satelliteId: params.satelliteId,
      }
    }

    // Extension / Format filtering
    const effectiveExtension = extractedExtension && extractedExtension !== "ALL" ? extractedExtension : undefined
    if (effectiveExtension) {
      const ext = effectiveExtension.toLowerCase().replace(/^\./, "")
      if (ext === "data") {
        whereClause.extension = { in: ["csv", "dat", "raw", "tsv", "bin"] }
      } else if (ext === "telemetry") {
        whereClause.extension = { in: ["json", "xml", "log", "yaml", "yml"] }
      } else if (ext === "document") {
        whereClause.extension = { in: ["pdf", "doc", "docx", "txt", "rtf"] }
      } else {
        whereClause.extension = ext
      }
    }

    // Report Category filtering
    if (params.category && params.category !== "ALL") {
      whereClause.report = {
        ...whereClause.report,
        ...reportCategoryWhere(params.category),
      }
    }

    // Classification Level filtering
    if (params.classificationLevel && params.classificationLevel !== "ALL") {
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
    const sortBy = params.sortBy || "updatedAt"
    const sortOrder = params.sortOrder || "desc"
    const orderBy: any = { [sortBy]: sortOrder }

    const [total, files] = await Promise.all([
      prisma.file.count({ where: whereClause }),
      prisma.file.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy,
        include: {
          uploader: {
            select: { id: true, name: true },
          },
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
      sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : "0",
      departmentId: f.departmentId,
      departmentName: f.department?.name || "",
      departmentCode: f.department?.code || "",
      departmentIsActive: f.department?.isActive ?? true,
      satelliteId: f.department?.satelliteId || f.department?.satellite?.id || null,
      satelliteName: f.report?.spacecraft || f.department?.satellite?.name || "",
      satelliteCode: f.department?.satellite?.code || null,
      hddPath: params.isAdmin ? f.hddPath || "" : "",
      reportTitle: f.report?.title || f.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
      reportAuthor: f.report?.createdBy?.name || f.uploader?.name || null,
      reportCategory: categoryCodeOf(f.report),
      customCategory: f.report?.customCategory || null,
      classificationLevel: f.report?.classificationLevel || null,
      versionLabel: f.report?.versionLabel || null,
      isFeatured: Boolean(f.isFeatured),
      createdAt: f.createdAt ? f.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: f.updatedAt ? f.updatedAt.toISOString() : new Date().toISOString(),
    }))

    return { results, total, page, limit }
  },
}
