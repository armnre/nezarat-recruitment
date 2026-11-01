import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import * as D from '@radix-ui/react-dialog';
import { ChevronLeft, GraduationCap, LogOut, Menu, X, type LucideIcon } from 'lucide-react';
import { useLogout, useMe } from '../lib/auth';
import { cn, fa } from '../lib/format';

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

type Props = {
  /** Name of the panel, e.g. «پنل مدیریت». */
  area: string;
  nav: NavItem[];
  /** Applicant panel also gets a thumb-reachable tab bar on phones. */
  bottomNav?: boolean;
  brandIcon?: LucideIcon;
};

function activeItem(nav: NavItem[], path: string) {
  return [...nav].sort((a, b) => b.to.length - a.to.length).find((n) => (n.end ? path === n.to : path === n.to || path.startsWith(`${n.to}/`)));
}

function Brand({ area, icon: Icon }: { area: string; icon: LucideIcon }) {
  const { data: me } = useMe();
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><Icon className="h-5 w-5" aria-hidden /></span>
      <div className="min-w-0 leading-tight">
        <div className="truncate font-bold">{me?.tenant?.name ?? 'سامانه جذب'}</div>
        <div className="truncate text-xs text-sidebar-muted">{area}</div>
      </div>
    </div>
  );
}

function SideNav({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="منوی اصلی" className="flex-1 space-y-1 overflow-y-auto px-3">
      {nav.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors', isActive ? 'bg-sidebar-active font-medium text-sidebar-foreground shadow-[inset_-3px_0_0_hsl(var(--accent))]' : 'text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground')}>
          <n.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />{n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function UserBox() {
  const { data: me } = useMe();
  const logout = useLogout();
  const name = me?.fullName || (me?.mobile ? fa(me.mobile) : me?.email) || 'کاربر';
  return (
    <div className="m-3 flex items-center gap-3 rounded-md bg-sidebar-active/50 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-foreground/10 text-sm font-bold" aria-hidden>{name.trim().charAt(0)}</span>
      <div className="min-w-0 flex-1 truncate text-sm">{name}</div>
      <button onClick={logout} className="rounded-md p-2 text-sidebar-muted hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground" aria-label="خروج از حساب" title="خروج">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function Sidebar({ area, nav, icon, onNavigate }: { area: string; nav: NavItem[]; icon: LucideIcon; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Brand area={area} icon={icon} />
      <SideNav nav={nav} onNavigate={onNavigate} />
      <UserBox />
    </div>
  );
}

/** Shared application frame for all role panels: sidebar (desktop), drawer (mobile), header with breadcrumb. */
export default function AppShell({ area, nav, bottomNav, brandIcon = GraduationCap }: Props) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const current = activeItem(nav, pathname);
  const nested = current && pathname !== current.to;
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a href="#main" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:right-3 focus:top-3">پرش به محتوای اصلی</a>
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh"><Sidebar area={area} nav={nav} icon={brandIcon} /></aside>

      <div className={cn('min-w-0', bottomNav && 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0')}>
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <D.Root open={open} onOpenChange={setOpen}>
              <D.Trigger className="-mr-2 rounded-md p-2 hover:bg-muted lg:hidden" aria-label="باز کردن منو"><Menu className="h-5 w-5" /></D.Trigger>
              <D.Portal>
                <D.Overlay className="fixed inset-0 z-40 bg-foreground/45 animate-fade-in lg:hidden" />
                <D.Content dir="rtl" aria-describedby={undefined} className="fixed inset-y-0 right-0 z-50 w-[min(18rem,85vw)] shadow-raised animate-fade-in lg:hidden">
                  <D.Title className="sr-only">منوی {area}</D.Title>
                  <D.Close className="absolute left-3 top-6 z-10 rounded-md p-1.5 text-sidebar-muted hover:text-sidebar-foreground" aria-label="بستن منو"><X className="h-5 w-5" /></D.Close>
                  <Sidebar area={area} nav={nav} icon={brandIcon} onNavigate={() => setOpen(false)} />
                </D.Content>
              </D.Portal>
            </D.Root>
            <nav aria-label="مسیر" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden shrink-0 text-muted-foreground sm:block">{area}</li>
                {current && <li className="hidden shrink-0 sm:block" aria-hidden><ChevronLeft className="h-4 w-4 text-muted-foreground/60" /></li>}
                {current && (nested
                  ? <li className="min-w-0 truncate"><NavLink to={current.to} end className="text-muted-foreground hover:text-foreground">{current.label}</NavLink></li>
                  : <li className="min-w-0 truncate font-medium" aria-current="page">{current.label}</li>)}
                {nested && <><li aria-hidden><ChevronLeft className="h-4 w-4 text-muted-foreground/60" /></li><li className="truncate font-medium" aria-current="page">جزئیات</li></>}
              </ol>
            </nav>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"><Outlet /></main>
      </div>

      {bottomNav && (
        <nav aria-label="منوی سریع" className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0,1fr))` }}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px]', isActive ? 'font-medium text-primary' : 'text-muted-foreground')}>
              <n.icon className="h-5 w-5" aria-hidden /><span className="truncate">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
