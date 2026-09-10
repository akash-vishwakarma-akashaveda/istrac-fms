import { z } from 'zod'

const HDD_ROOT = '/mnt/istrac_storage/'

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Division code is required').optional(),
  folderName: z
    .string()
    .min(1, 'Folder name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, underscores and hyphens only'),
  pageTitle: z.string().optional(),
  pageAbout: z.string().optional(),
  pageLeadOfficer: z.string().optional(),
  pageLeadRole: z.string().optional(),
  pageContact: z.string().optional(),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
export { HDD_ROOT }