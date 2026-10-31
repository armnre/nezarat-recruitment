import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Building, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useLogout, useMe } from '../../lib/auth';
import { cn } from '../../lib/format';

const nav = [
  { to: '/platform', label: 'دانشگاه‌ها و اشتراک', icon: Building, end: true },
  { to: '/platform/users', label: 'کاربران', icon: Users },
  { to: '/platform/performance', label: 'گزارش عملکرد', icon: Activity },
];

export default function PlatformLayout() {
  const { data: me } = useMe();
  const logout = useLogout();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      <aside className="border-b bg-card md:sticky md:top-0 md:h-screen md:border-b-0 md:border-l">
        <div className="flex h-14 items-center gap-2 px-4 font-bold text-primary"><ShieldCheck className="h-6 w-6" />مدیریت پلتفرم</div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm', isActive ? 'bg-secondary font-medium text-secondary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <n.icon className="h-4 w-4" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t p-3 text-sm md:absolute md:inset-x-0 md:bottom-0 md:block">
          <div className="truncate text-muted-foreground">{me?.fullName || me?.email}</div>
          <button onClick={logout} className="mt-2 flex items-center gap-1 text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" />خروج</button>
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-8"><Outlet /></main>
    </div>
  );
}
