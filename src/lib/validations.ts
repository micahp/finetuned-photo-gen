import { z } from 'zod'

// Authentication schemas
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long')
    .max(100, 'Password must be less than 100 characters'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  agreeToTerms: z
    .boolean()
    .refine(val => val === true, {
      message: 'You must agree to the Terms of Service and Privacy Policy'
    }),
})

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z
    .string()
    .min(1, 'Password is required'),
})

// Model creation schemas
export const createModelSchema = z.object({
  name: z
    .string()
    .min(1, 'Model name is required')
    .max(50, 'Model name must be less than 50 characters'),
  images: z
    .array(z.instanceof(File))
    .min(10, 'At least 10 images are required')
    .max(20, 'Maximum 20 images allowed'),
})

// Image generation schemas
export const generateImageSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt is required')
    .max(500, 'Prompt must be less than 500 characters'),
  modelId: z
    .string()
    .min(1, 'Model selection is required'),
  style: z
    .string()
    .optional(),
  aspectRatio: z
    .enum(['1:1', '16:9', '9:16', '3:4', '4:3'])
    .default('1:1'),
  quantity: z
    .number()
    .min(1)
    .max(4)
    .default(1),
})

// Type exports
export type RegisterFormData = z.infer<typeof registerSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type CreateModelFormData = z.infer<typeof createModelSchema>
export type GenerateImageFormData = z.infer<typeof generateImageSchema> 