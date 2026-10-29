import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, Megaphone, UserRound } from 'lucide-react';
import { useLogout, useMe } from '../../lib/auth';
import { cn, fa } from '../../lib/format';

const nav = [
  { to: '/applicant', label: 'پیشخوان', icon: LayoutDashboard, end: true },
  { to: '/applicant/profile', label: 'پرونده', icon: UserRound },
  { to: '/applicant/resume', label: 'رزومه علمی', icon: BookOpen },
  { to: '/applicant/calls', label: 'فراخوان‌ها', icon: Megaphone },
];

export default function ApplicantLayout() {
  const { data: me } = useMe();
  const logout = useLogout();
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="container flex h-14 max-w-6xl items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-primary"><GraduationCap className="h-6 w-6" /><span className="hidden sm:inline">{me?.tenant?.name ?? 'سامانه جذب'}</span></div>
          <nav className="hidden flex-1 gap-1 md:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm', isActive ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                <n.icon className="h-4 w-4" />{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mr-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{me?.fullName || fa(me?.mobile ?? '')}</span>
            <button onClick={logout} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted" aria-label="خروج"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">خروج</span></button>
          </div>
        </div>
      </header>
      <main className="container max-w-6xl py-6"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card md:hidden">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2 text-[11px]', isActive ? 'text-primary' : 'text-muted-foreground')}>
            <n.icon className="h-5 w-5" />{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{title}</h1>{sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}</div>
      {action}
    </div>
  );
}

