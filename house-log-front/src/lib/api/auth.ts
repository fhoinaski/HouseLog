import { request } from './_core';
import type { AuthPairResponse, MfaChallengeResponse, User } from './_core';

export const authApi = {
  register: (data: { email: string; name: string; password: string; role?: string; phone?: string; provider_categories?: string[] }) =>
    request<AuthPairResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (email: string, password: string) =>
    request<AuthPairResponse | MfaChallengeResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  mfaChallenge: (challenge_token: string, code: string) =>
    request<AuthPairResponse>('/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify({ challenge_token, code }),
    }),

  me: () => request<{ user: User & { mfa_enabled?: boolean } }>('/auth/me'),

  refresh: (refresh_token: string) =>
    request<AuthPairResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),

  logout: (refresh_token?: string) =>
    request<{ ok: true }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify(refresh_token ? { refresh_token } : {}),
    }),

  mfaSetup: () => request<{ secret: string; otpauth_uri: string }>('/auth/mfa/setup', { method: 'POST' }),

  mfaVerify: (code: string) =>
    request<{ enabled: true; backup_codes: string[] }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  mfaDisable: (password: string) =>
    request<{ enabled: false }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  updateProfile: (data: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    service_area?: string;
    pix_key?: string;
    pix_key_type?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    provider_bio?: string;
    provider_courses?: string[];
    provider_specializations?: string[];
    provider_portfolio?: string[];
    provider_education?: Array<{
      institution: string;
      title: string;
      type: 'college' | 'technical' | 'course' | 'certification' | 'other';
      status: 'in_progress' | 'completed';
      certificationUrl?: string;
    }>;
    provider_portfolio_cases?: Array<{
      title: string;
      description?: string;
      beforeImageUrl?: string;
      afterImageUrl?: string;
    }>;
    provider_categories?: string[];
  }) => request<{ user: User }>('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>('/auth/password', { method: 'PUT', body: JSON.stringify(data) }),

  updateNotificationPrefs: (prefs: Record<string, boolean>) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ notification_prefs: JSON.stringify(prefs) }),
    }),
};
