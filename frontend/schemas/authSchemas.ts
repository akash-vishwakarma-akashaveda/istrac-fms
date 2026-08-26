import { z } from 'zod'

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
})

export const otpSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
})

export const newPasswordSchema = z
  .object({
    newPassword: z.string().min(10),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(10, 'Password must be at least 10 characters long')
  
})

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Full Name is required'),
    designation: z.string().min(2, 'Designation / Title is required'),
    email: z.string().email('Enter a valid official ISRO email address'),
    employeeId: z.string().min(1, 'ISRO Employee / Badge ID is required'),
    phone: z.string().min(7, 'Enter a valid contact number (e.g. +91 98765 43210)'),
    departmentPreference: z.string().min(1, 'Select a target operational department'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    confirmPassword: z.string().min(8, 'Confirm your password'),
    reasonForAccess: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type RegisterFormData = z.infer<typeof registerSchema>
export type LoginFormData = z.infer<typeof loginSchema>