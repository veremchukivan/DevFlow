import { z } from "zod";

export const registerRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(256)
});

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256)
});

export const authUserSchema = z.object({
  createdAt: z.string().datetime(),
  displayName: z.string(),
  email: z.string().email(),
  id: z.uuid(),
  isEmailVerified: z.boolean(),
  isPlatformAdmin: z.boolean()
});

export const emailVerificationTokenRequestSchema = z.object({
  token: z.string().trim().min(1).max(512)
});

export const authResponseSchema = z.object({
  user: authUserSchema
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
