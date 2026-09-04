import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware.js'
import { deptAccessMiddleware } from '../middleware/deptAccess.middleware.js'
import { searchService } from '../services/search.service.js'

const router = Router()

// ============================================================
// LIST FILES & FOLDERS IN DEPARTMENT
// ============================================================
router.get('/departments/:deptId/files', authMiddleware, deptAccessMiddleware, async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId
    const parentId = (req.query.parentId as string) || null
    const type = req.query.type as 'FILE' | 'FOLDER' | undefined

    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
    const skip = (page - 1) * limit
    const isAdmin = req.user?.role === 'ADMIN'
    const where: any = {
      departmentId: deptId,
      parentId,
      deletedAt: null,
      status: 'ACTIVE',
      ...(type && { nodeType: type }),
      ...(!isAdmin ? {
        versions: {
          some: {
            isVisible: true,
            deletedAt: null,
          },
        },
      } : {}),
    }

    const [total, items] = await Promise.all([
      prisma.file.count({ where }),
      prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ nodeType: 'asc' }, { name: 'asc' }],
        include: {
          uploader: { select: { id: true, name: true } },
          versions: {
            where: {
              deletedAt: null,
              ...(!isAdmin ? { isVisible: true } : {}),
            },
            orderBy: { versionNum: 'desc' },
            take: 1,
            select: { name: true, sizeBytes: true, versionLabel: true },
          },
          _count: {
            select: {
              versions: {
                where: {
                  deletedAt: null,
                  ...(!isAdmin ? { isVisible: true } : {}),
                },
              },
            },
          },
          report: {
            select: {
              id: true,
              title: true,
              spacecraft: true,
              category: true,
              reportNumber: true,
              versionLabel: true,
            },
          },
        },
      }),
    ])

    res.json({
      data: items.map((item: any) => {
        const activeVer = item.versions?.[0]
        const displayName = (!isAdmin && activeVer?.name) ? activeVer.name : item.name
        const displaySize = (!isAdmin && activeVer?.sizeBytes) ? activeVer.sizeBytes.toString() : (item.sizeBytes ? item.sizeBytes.toString() : null)
        const displayLabel = (!isAdmin && activeVer?.versionLabel) ? activeVer.versionLabel : (item.report?.versionLabel || `V${item.versionCount || 1}.0`)
        const versionCount = !isAdmin ? (item._count?.versions ?? (activeVer ? 1 : 0)) : (item.versionCount || 1)

        return {
          id: item.id,
          name: displayName,
          nodeType: item.nodeType,
          mimeType: item.mimeType,
          extension: item.extension,
          sizeBytes: displaySize,
          versionCount,
          versionLabel: displayLabel,
          uploader: item.uploader?.name || 'System',
          spacecraft: item.report?.spacecraft ? (item.report.spacecraft.includes('General') ? 'General' : item.report.spacecraft) : null,
          title: item.report?.title || null,
          category: item.report?.category || null,
          reportNumber: item.report?.reportNumber || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          isFeatured: Boolean(item.isFeatured),
        }
      }),
      accessLevel: req.deptAccessLevel || 'READ_ONLY',
      total,
      page,
      limit,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// RECURSIVE FOLDER TREE (FOLDERS ONLY)
// ============================================================
router.get('/departments/:deptId/tree', authMiddleware, deptAccessMiddleware, async (req, res, next) => {
  try {
    const rawDeptId = req.params.deptId
    const deptId = Array.isArray(rawDeptId) ? rawDeptId[0] : rawDeptId

    const folders = await prisma.file.findMany({
      where: {
        departmentId: deptId,
        nodeType: 'FOLDER',
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
      orderBy: { name: 'asc' },
    })

    interface TreeNode {
      id: string
      name: string
      parentId: string | null
      children: TreeNode[]
    }

    const nodeMap = new Map<string, TreeNode>()
    folders.forEach((f: any) => {
      nodeMap.set(f.id, { ...f, children: [] })
    })

    const rootNodes: TreeNode[] = []

    folders.forEach((f: any) => {
      const node = nodeMap.get(f.id)!
      if (f.parentId && nodeMap.has(f.parentId)) {
        nodeMap.get(f.parentId)!.children.push(node)
      } else {
        rootNodes.push(node)
      }
    })

    res.json({
      data: rootNodes,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// FULL-TEXT SEARCH (SCOPED TO USER OR PUBLIC DISCOVERY)
// ============================================================
router.get('/search', optionalAuthMiddleware, async (req, res, next) => {
  try {
    const q = (req.query.q as string) || ''
    const departmentId = req.query.departmentId as string | undefined
    const satelliteId = req.query.satelliteId as string | undefined
    const category = req.query.category as string | undefined
    const extension = req.query.extension as string | undefined
    const classificationLevel = req.query.classificationLevel as string | undefined
    const startDate = req.query.startDate as string | undefined
    const endDate = req.query.endDate as string | undefined
    const sortBy = req.query.sortBy as any
    const sortOrder = req.query.sortOrder as any
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20

    const results = await searchService.search({
      query: q,
      userId: req.user?.id || '',
      isAdmin: req.user?.role === 'ADMIN',
      departmentId,
      satelliteId,
      category,
      extension,
      classificationLevel,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page,
      limit,
    })

    res.json({
      data: results.results,
      total: results.total,
      page: results.page,
      limit: results.limit,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as browseRouter }
