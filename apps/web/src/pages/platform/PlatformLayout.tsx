import { Activity, Building, ShieldCheck, Users } from 'lucide-react';
import AppShell, { type NavItem } from '../../components/AppShell';

const nav: NavItem[] = [
  { to: '/platform', label: 'دانشگاه‌ها و اشتراک', icon: Building, end: true },
  { to: '/platform/users', label: 'کاربران', icon: Users },
  { to: '/platform/performance', label: 'گزارش عملکرد', icon: Activity },
];

export default function PlatformLayout() {
  return <AppShell area="مدیریت پلتفرم" nav={nav} brandIcon={ShieldCheck} />;
}
