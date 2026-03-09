// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterTenantDto {
  tenantName: string;
  tenantCode: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface AuthUser {
  tenantSlug: string;
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  createdAt?: string;
}

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'warehouse_manager'
  | 'sales'
  | 'accountant'
  | 'user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface LoginResponseData {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface RefreshResponseData {
  accessToken: string;
  expiresIn: number;
}
