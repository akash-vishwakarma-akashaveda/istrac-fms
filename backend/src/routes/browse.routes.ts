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

    const where: any = {
      departmentId: deptId,
      parentId,
      deletedAt: null,
      status: 'ACTIVE',
      ...(type && { nodeType: type }),
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
        },
      }),
    ])

    res.json({
      data: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        nodeType: item.nodeType,
        mimeType: item.mimeType,
        extension: item.extension,
        sizeBytes: item.sizeBytes ? item.sizeBytes.toString() : null,
        versionCount: item.versionCount,
        uploader: item.uploader.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
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
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20

    const results = await searchService.search({
      query: q,
      userId: req.user?.id || '',
      isAdmin: req.user?.role === 'ADMIN',
      departmentId,
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
