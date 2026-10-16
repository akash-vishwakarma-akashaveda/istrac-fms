import { Router } from 'express'
import { prisma } from '../config/db.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../lib/errors.js'
import { adminMiddleware } from '../middleware/admin.middleware.js'
import { auditService } from '../services/audit.service.js'
import { normalizeCategoryCode, categoryCodeOf, categoryEnumFor, CODE_TO_ENUM } from '../lib/reportCategory.js'

const router = Router()

// Default Built-in Categories
const DEFAULT_CATEGORIES = [
  { name: 'General', code: 'GENERAL', description: 'General documentation and files', isSystem: true },
  { name: 'Daily Report', code: 'DAILYOPS', description: 'Regular 24-hour mission tracking log', isSystem: true },
  { name: 'Anomaly Report', code: 'ANOMALY', description: 'Telemetry or payload subsystem anomalies', isSystem: true },
  { name: 'Special Operations Report', code: 'SPECOPS', description: 'Orbit maneuvers, solar arrays, maneuvers', isSystem: true },
  { name: 'Study / Analysis Report', code: 'STUDY', description: 'Scientific & engineering flight dynamics studies', isSystem: true },
  { name: 'Payload Operations Report', code: 'PAYLOADOPS', description: 'Science sensor & instrument operation reports', isSystem: true },
]

// Default Built-in Naming Presets
const DEFAULT_NAMING_PRESETS = [
  {
    name: 'ISRO SPOA Standard (Slide 4)',
    template: '{SAT}_{TYPE}_{YYYYMMDD}_{VER}',
    description: 'Standard ISRO convention: e.g. EOS08_DAILYOPS_20260622_V1.0.pdf',
    isDefault: true,
  },
  {
    name: 'Departmental Ground Station',
    template: '{DEPT}_{SAT}_{TYPE}_{YYYYMMDD}_{VER}',
    description: 'Includes division prefix: e.g. FDD_ADITYAL1_DAILYOPS_20260825_V1.0.pdf',
    isDefault: false,
  },
  {
    name: 'Chronological Telemetry Index',
    template: '{YYYYMMDD}_{SAT}_{TYPE}_{TITLE}_{VER}',
    description: 'Date-first sorting: e.g. 20260825_ADITYAL1_DAILYOPS_OrbitManeuver_V1.0.pdf',
    isDefault: false,
  },
  {
    name: 'Detailed Mission with Author',
    template: '{SAT}_{TYPE}_{TITLE}_{AUTHOR}_{YYYYMMDD}',
    description: 'Full tracking metadata: e.g. EOS08_SPECOPS_SolarArrayDeploy_Ashish_20260825.pdf',
    isDefault: false,
  },
]

// Helper: find all active files associated with a category
function buildCategoryFileWhere(category: { code: string; name?: string }): any {
  const clean = normalizeCategoryCode(category.code)
  // Only codes that really map to a legacy enum match old rows; categoryEnumFor() falls back to OTHER for
  // every custom code, which made each new category "own" all legacy OTHER files.
  const legacy = CODE_TO_ENUM[clean]
  const isGeneral = clean === 'GENERAL' || clean === 'OTHER'
  const orList: any[] = [
    { customCategory: clean },
    { customCategory: category.code },
  ]
  if (category.name) {
    orList.push({ customCategory: category.name })
  }
  if (legacy && (!isGeneral || legacy === 'OTHER')) {
    orList.push({ category: legacy })
  }

  return {
    deletedAt: null,
    nodeType: 'FILE',
    report: {
      deletedAt: null,
      OR: orList,
    },
  }
}

// ============================================================
// LIST CATEGORIES (SYSTEM + CUSTOM SAVED)
// ============================================================
router.get('/report-presets/categories', authMiddleware, async (req, res, next) => {
  try {
    let custom = await prisma.reportCategoryPreset.findMany({
      orderBy: { createdAt: 'asc' },
    })

    // Seed defaults if empty
    if (custom.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await prisma.reportCategoryPreset.upsert({
          where: { code: cat.code },
          update: {},
          create: cat,
        })
      }
      custom = await prisma.reportCategoryPreset.findMany({
        orderBy: { createdAt: 'asc' },
      })
    }

    // Accurate active files count for each category across all files
    const fileCategoryCounts = new Map<string, number>()
    const activeReports = await prisma.file.findMany({
      where: { deletedAt: null, nodeType: 'FILE', report: { isNot: null } },
      select: {
        report: { select: { category: true, customCategory: true } },
      },
    })
    for (const f of activeReports) {
      if (!f.report) continue
      const code = categoryCodeOf(f.report) || 'GENERAL'
      fileCategoryCounts.set(code, (fileCategoryCounts.get(code) || 0) + 1)
    }

    res.json({
      data: custom.map((c: any) => ({
        ...c,
        usageCount: fileCategoryCounts.get(c.code) ?? 0,
      })),
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CREATE CUSTOM CATEGORY PRESET
// ============================================================
router.post('/report-presets/categories', authMiddleware, async (req, res, next) => {
  try {
    const { name, code, description } = req.body

    if (!name || !code) {
      throw new AppError('missing_fields', 'Category name and short code are required', 400)
    }

    const cleanCode = normalizeCategoryCode(code).replace(/_/g, '')
    if (!cleanCode) {
      throw new AppError('invalid_code', 'Category code must contain alphanumeric characters', 400)
    }

    const existing = await prisma.reportCategoryPreset.findFirst({
      where: {
        OR: [{ name: name.trim() }, { code: cleanCode }],
      },
    })

    if (existing) {
      throw new AppError('category_exists', 'A category with this name or code already exists', 409)
    }

    const created = await prisma.reportCategoryPreset.create({
      data: {
        name: name.trim(),
        code: cleanCode,
        description: description?.trim() || null,
        isSystem: false,
      },
    })

    res.status(201).json({
      data: created,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: CHECK RELATED FILES BEFORE CATEGORY DELETION
// ============================================================
router.get('/report-presets/categories/:id/related-files', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    const category = await prisma.reportCategoryPreset.findUnique({
      where: { id },
    })

    if (!category) {
      throw new AppError('not_found', 'Report category not found', 404)
    }

    const fileWhere = buildCategoryFileWhere(category)

    const [count, sampleFiles] = await Promise.all([
      prisma.file.count({ where: fileWhere }),
      prisma.file.findMany({
        where: fileWhere,
        take: 5,
        select: {
          id: true,
          name: true,
          sizeBytes: true,
          createdAt: true,
          department: { select: { id: true, name: true, code: true } },
          report: { select: { id: true, title: true, spacecraft: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    res.json({
      data: {
        categoryId: category.id,
        categoryName: category.name,
        categoryCode: category.code,
        isSystem: category.isSystem,
        count,
        canDelete: count === 0,
        sampleFiles: sampleFiles.map((f: any) => ({
          id: f.id,
          name: f.name,
          departmentName: f.department?.name,
          departmentCode: f.department?.code,
          reportTitle: f.report?.title,
          createdAt: f.createdAt,
        })),
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// ADMIN: PERMANENT DELETE CATEGORY PRESET
// Stops if active files are associated; requires admin to delete files manually first
// ============================================================
router.delete('/report-presets/categories/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    const category = await prisma.reportCategoryPreset.findUnique({
      where: { id },
    })

    if (!category) {
      throw new AppError('not_found', 'Report category not found', 404)
    }

    if (category.isSystem) {
      throw new AppError('cannot_delete_system', 'Default system categories cannot be deleted', 400)
    }

    const fileWhere = buildCategoryFileWhere(category)
    const count = await prisma.file.count({ where: fileWhere })

    if (count > 0) {
      const sample = await prisma.file.findMany({
        where: fileWhere,
        take: 3,
        select: { name: true },
      })
      const fileNames = sample.map((f) => `"${f.name}"`).join(', ')
      const extraMsg = count > 3 ? ` and ${count - 3} other(s)` : ''
      throw new AppError(
        'category_has_files',
        `Cannot delete report category "${category.name}". There are ${count} file(s) associated with this category (${fileNames}${extraMsg}). Please delete all related files manually first.`,
        400,
        { fileCount: count }
      )
    }

    // Zero files associated - hard delete the category
    const clean = normalizeCategoryCode(category.code)
    await prisma.$transaction(async (tx) => {
      // Clean up any empty orphaned report rows matching this category if no files exist
      await tx.report.deleteMany({
        where: {
          deletedAt: null,
          files: { none: {} },
          OR: [
            { customCategory: clean },
            { customCategory: category.code },
            ...(category.name ? [{ customCategory: category.name }] : []),
          ],
        },
      })
      await tx.reportCategoryPreset.delete({
        where: { id: category.id },
      })
    })

    auditService.log({
      userId: req.user!.id,
      action: 'DELETE_PERMANENT:/report-presets/categories',
      resourceType: 'report_category',
      resourceId: category.id,
      oldValue: {
        name: category.name,
        code: category.code,
        isSystem: category.isSystem,
      },
    })

    res.json({
      data: {
        message: `Report category "${category.name}" has been permanently deleted.`,
      },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// LIST NAMING PRESETS
// ============================================================
router.get('/report-presets/naming', authMiddleware, async (req, res, next) => {
  try {
    let presets = await prisma.namingPreset.findMany({
      orderBy: { createdAt: 'asc' },
    })

    // Seed defaults if empty
    if (presets.length === 0) {
      for (const p of DEFAULT_NAMING_PRESETS) {
        await prisma.namingPreset.upsert({
          where: { name: p.name },
          update: {},
          create: p,
        })
      }
      presets = await prisma.namingPreset.findMany({
        orderBy: { createdAt: 'asc' },
      })
    }

    res.json({
      data: presets,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// CREATE CUSTOM NAMING PRESET
// ============================================================
router.post('/report-presets/naming', authMiddleware, async (req, res, next) => {
  try {
    const { name, template, description } = req.body

    if (!name || !template) {
      throw new AppError('missing_fields', 'Preset name and template format are required', 400)
    }

    const existing = await prisma.namingPreset.findUnique({
      where: { name: name.trim() },
    })

    if (existing) {
      throw new AppError('preset_exists', 'A naming preset with this name already exists', 409)
    }

    const created = await prisma.namingPreset.create({
      data: {
        name: name.trim(),
        template: template.trim(),
        description: description?.trim() || null,
        isDefault: false,
      },
    })

    res.status(201).json({
      data: created,
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

// ============================================================
// DELETE CUSTOM NAMING PRESET
// ============================================================
router.delete('/report-presets/naming/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const rawId = req.params.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    const preset = await prisma.namingPreset.findUnique({
      where: { id },
    })

    if (!preset) {
      throw new AppError('not_found', 'Naming preset not found', 404)
    }

    if (preset.isDefault) {
      throw new AppError('cannot_delete_default', 'Default naming preset cannot be deleted', 400)
    }

    await prisma.namingPreset.delete({
      where: { id },
    })

    res.json({
      data: { message: 'Naming preset deleted successfully' },
      requestId: req.requestId,
    })
  } catch (err) {
    next(err)
  }
})

export { router as reportPresetRouter }
