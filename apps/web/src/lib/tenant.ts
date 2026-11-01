import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export type PublicTenant = { id: string; slug: string; name: string; otpEnabled?: boolean };

/**
 * دانشگاه از hostname تعیین می‌شود (GET /public/tenant با هدر Host).
 * VITE_TENANT_SLUG فقط برای توسعهٔ محلی (localhost) به‌عنوان جایگزین استفاده می‌شود.
 */
export async function resolveTenant(): Promise<PublicTenant | null> {
  try {
    return await api<PublicTenant>('/public/tenant');
  } catch {
    const fallback = import.meta.env.VITE_TENANT_SLUG as string | undefined;
    if (!fallback) return null;
    return api<PublicTenant>(`/public/tenants/${encodeURIComponent(fallback)}`).catch(() => null);
  }
}

export function useTenant() {
  return useQuery({ queryKey: ['public-tenant'], queryFn: resolveTenant, staleTime: Infinity, retry: false });
}
