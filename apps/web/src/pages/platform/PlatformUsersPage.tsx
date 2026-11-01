import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { fa, jDate } from '../../lib/format';
import { Alert, Button, Card, CardContent, DataTable, PageTitle, Pagination, SearchInput, Select, Skeleton } from '../../components/ui';
import { ROLE_LABELS, type PlatformUser, type TenantRow } from './types';

export default function PlatformUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [tenantId, setTenantId] = useState(''); const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  const PER = 50;
  const tenants = useQuery({ queryKey: ['platform-tenants'], queryFn: () => api<TenantRow[]>('/platform/tenants') });
  const users = useQuery({
    queryKey: ['platform-users', q, tenantId, page],
    queryFn: () => api<PlatformUser[]>(`/platform/users?limit=${PER}&offset=${page * PER}${q ? `&search=${encodeURIComponent(q)}` : ''}${tenantId ? `&tenantId=${tenantId}` : ''}`),
  });
  const toggle = useMutation({
    mutationFn: (u: PlatformUser) => api(`/platform/users/${u.id}`, { method: 'PATCH', body: { status: u.status === 'active' ? 'suspended' : 'active' } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-users'] }),
  });
  return (
    <>
      <PageTitle title="کاربران" sub="همهٔ کاربران دانشگاه‌ها؛ جست‌وجو و تعلیق حساب." />
      <Card><CardContent className="pt-5">
        {toggle.error && <div className="mb-3"><Alert tone="error">{toggle.error instanceof ApiError ? toggle.error.message : 'خطا'}</Alert></div>}
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput label="جستجوی نام، موبایل یا ایمیل" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          <Select aria-label="فیلتر دانشگاه" className="w-full sm:w-56" value={tenantId} onChange={(e) => { setTenantId(e.target.value); setPage(0); }}>
            <option value="">همهٔ دانشگاه‌ها</option>{tenants.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div>
          {users.isLoading ? <Skeleton className="h-48" /> : (
            <DataTable label="فهرست کاربران" minWidth={760}>
              <thead><tr><th className="py-2 text-right font-medium">کاربر</th><th className="text-right font-medium">دانشگاه</th><th className="text-right font-medium">نقش‌ها</th><th className="text-right font-medium">آخرین ورود</th><th className="text-right font-medium">وضعیت</th><th /></tr></thead>
              <tbody>
                {!users.data?.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">کاربری یافت نشد</td></tr>}
                {users.data?.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2.5"><div className="font-medium">{u.fullName || '—'}</div><div className="text-xs text-muted-foreground">{u.mobile ? fa(u.mobile) : u.email}</div></td>
                    <td>{u.tenantName ?? 'پلتفرم'}</td>
                    <td className="text-xs">{u.roles.map((r) => ROLE_LABELS[r] ?? r).join('، ') || '—'}</td>
                    <td className="text-xs text-muted-foreground">{u.lastLoginAt ? jDate(u.lastLoginAt, true) : '—'}</td>
                    <td><span className={`rounded px-2 py-0.5 text-xs ${u.status === 'active' ? 'bg-secondary text-secondary-foreground' : 'bg-destructive/10 text-destructive'}`}>{u.status === 'active' ? 'فعال' : 'تعلیق'}</span></td>
                    <td className="text-left"><Button size="sm" variant="outline" loading={toggle.isPending && toggle.variables?.id === u.id} onClick={() => toggle.mutate(u)}>{u.status === 'active' ? 'تعلیق' : 'فعال‌سازی'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
        <Pagination page={page} hasNext={(users.data?.length ?? 0) === PER} onPage={setPage} />
      </CardContent></Card>
    </>
  );
}
