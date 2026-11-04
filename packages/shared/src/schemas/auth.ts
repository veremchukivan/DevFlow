import { z } from "zod";

export const registerRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(256),
});

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

export const authUserSchema = z.object({
  avatarUrl: z.string().max(500).nullable(),
  createdAt: z.string().datetime(),
  displayName: z.string(),
  email: z.string().email(),
  id: z.uuid(),
  isEmailVerified: z.boolean(),
  isPlatformAdmin: z.boolean(),
});

export const emailVerificationTokenRequestSchema = z.object({
  token: z.string().trim().min(1).max(512),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const passwordResetConfirmRequestSchema = z.object({
  password: z.string().min(8).max(256),
  token: z.string().trim().min(1).max(512),
});

export const updateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});
export const changeEmailRequestSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  email: z.string().trim().email().max(320),
});
export const deleteAccountRequestSchema = z.object({
  currentPassword: z.string().min(1).max(256),
});

export const apiTokenScopeSchema = z.enum(["api:read", "api:write"]);

export const createApiTokenRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  expiresAt: z.string().datetime().nullable().optional(),
  scopes: z
    .array(apiTokenScopeSchema)
    .min(1)
    .max(2)
    .default(["api:read", "api:write"]),
});
export const apiTokenSchema = z.object({
  createdAt: z.string().datetime(), expiresAt: z.string().datetime().nullable(), id: z.uuid(), lastUsedAt: z.string().datetime().nullable(), name: z.string(), scopes: z.array(apiTokenScopeSchema), tokenPrefix: z.string(),
});
export const apiTokenListResponseSchema = z.object({ tokens: z.array(apiTokenSchema) });
export const createApiTokenResponseSchema = z.object({ token: z.string().min(1), tokenInfo: apiTokenSchema });

export const authResponseSchema = z.object({
  user: authUserSchema,
});

export const accountSessionSchema = z.object({
  createdAt: z.string().datetime(),
  current: z.boolean(),
  expiresAt: z.string().datetime(),
  id: z.uuid(),
  ipAddress: z.string().nullable(),
  lastSeenAt: z.string().datetime(),
  userAgent: z.string().nullable(),
});

export const accountSessionListResponseSchema = z.object({
  sessions: z.array(accountSessionSchema),
});

export const accountSessionParamsSchema = z.object({
  sessionId: z.uuid(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;
export type AccountSessionListResponse = z.infer<
  typeof accountSessionListResponseSchema
>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type ChangeEmailRequest = z.infer<typeof changeEmailRequestSchema>;
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;
