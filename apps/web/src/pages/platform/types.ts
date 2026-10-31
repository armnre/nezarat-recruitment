export type TenantRow = {
  id: string; slug: string; name: string; hostname: string | null; status: 'active' | 'suspended'; plan: 'basic' | 'pro' | 'enterprise';
  maxApplicants: number; maxCalls: number; subscriptionEndsAt: string | null; createdAt: string; applicants: number; calls: number; users: number;
};
export type PlatformUser = {
  id: string; fullName: string; mobile: string | null; email: string | null; status: 'active' | 'suspended'; lastLoginAt: string | null;
  createdAt: string; tenantId: string | null; tenantName: string | null; roles: string[];
};
export type PerfRow = {
  id: string; name: string; status: string; plan: string; maxApplicants: number; maxCalls: number; subscriptionEndsAt: string | null;
  applicants: number; submitted: number; accepted: number; activeCalls: number; evaluations: number; sms30d: number; smsFailed30d: number; lastActivity: string | null;
};
export const PLAN_LABELS: Record<string, string> = { basic: 'پایه', pro: 'حرفه‌ای', enterprise: 'سازمانی' };
export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدیر پلتفرم', university_admin: 'مدیر دانشگاه', committee_chair: 'رئیس کمیته', committee_member: 'عضو کمیته', applicant: 'متقاضی', faculty_admin: 'مدیر دانشکده', department_admin: 'مدیر گروه',
};
export const isExpired = (d: string | null) => !!d && new Date(d) < new Date();
