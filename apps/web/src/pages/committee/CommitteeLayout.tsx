import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, GraduationCap, LogOut, Users } from 'lucide-react';
import { useLogout, useMe } from '../../lib/auth';
import { cn, fa } from '../../lib/format';

export const canManage = (perms: string[] = []) => perms.includes('evaluations.finalize') || perms.includes('members.manage');

export default function CommitteeLayout() {
  const { data: me } = useMe();
  const logout = useLogout();
  const nav = [
    { to: '/committee', label: 'کارتابل ارزیابی', icon: ClipboardList, end: true },
    ...(canManage(me?.permissions) ? [{ to: '/committee/queue', label: 'مدیریت کمیته', icon: Users, end: false }] : []),
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="container flex h-14 max-w-7xl items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-primary"><GraduationCap className="h-6 w-6" /><span className="hidden sm:inline">کمیتهٔ جذب · {me?.tenant?.name}</span></div>
          <nav className="flex flex-1 gap-1">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm', isActive ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                <n.icon className="h-4 w-4" /><span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mr-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{me?.fullName || fa(me?.mobile ?? '')}</span>
            <button onClick={logout} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted" aria-label="خروج"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="container max-w-7xl py-6"><Outlet /></main>
    </div>
  );
}
