import { z } from 'zod'

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
})

export const otpSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
})

export const newPasswordSchema = z
  .object({
    newPassword:  z.string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(10).max(128),
  
})

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Full Name is required').max(100,'Name is too long'),
    designation: z.string().min(2, 'Designation / Title is required').max(100),
    email:  z
  .email('Enter a valid email address')
  .refine(
    (v) => v.endsWith('@isro.gov.in') || v.endsWith('@istrac.gov.in') || v.endsWith('@dos.gov.in'),
    'Only official ISRO/ISTRAC government email addresses are permitted'
  ),
    employeeId: z.string().min(1, 'ISRO Employee / Badge ID is required'),
    phone: z.string()
  .min(7)
  .regex(/^\+?[\d\s\-()+]{7,20}$/, 'Enter a valid contact number (e.g. +91 98765 43210)'),
    departmentPreference: z.string().min(1, 'Select a target operational department'),
   password: z.string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword:  z.string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    reasonForAccess: z.string().max(1000, 'Reason must be under 1000 characters').optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
export type LoginFormData = z.infer<typeof loginSchema>