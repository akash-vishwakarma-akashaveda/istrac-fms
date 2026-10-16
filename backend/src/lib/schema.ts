
import { string, z } from 'zod'
const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
export const  RegisterSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.email().toLowerCase().trim().regex(emailRegex),
  employeeId: z.string().max(30).optional(),
  designation: z.string().max(100).optional(),
  phone: z.string().max(20).regex(/^\+?[\d\s\-()]+$/).optional(),
  password: z.string().min(10).max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  departmentPreference: z.string().max(200).optional(),
  reasonForAccess: z.string().max(1000).optional(),
})

export const LoginSchema = z.object({
  email: z.email().toLowerCase().trim().regex(emailRegex),
  password: z.string().min(10).max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character')
})



