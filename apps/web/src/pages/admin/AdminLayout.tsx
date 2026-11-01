import { BarChart3, Building2, FileStack, LayoutDashboard, Megaphone, MessageSquareText, Users } from 'lucide-react';
import AppShell, { type NavItem } from '../../components/AppShell';

const nav: NavItem[] = [
  { to: '/admin', label: 'پیشخوان', icon: LayoutDashboard, end: true },
  { to: '/admin/calls', label: 'فراخوان‌ها', icon: Megaphone },
  { to: '/admin/applications', label: 'پرونده‌ها', icon: FileStack },
  { to: '/admin/members', label: 'اعضای کمیته', icon: Users },
  { to: '/admin/org', label: 'ساختار سازمانی', icon: Building2 },
  { to: '/admin/templates', label: 'قالب پیام‌ها', icon: MessageSquareText },
  { to: '/admin/reports', label: 'گزارش و رویدادها', icon: BarChart3 },
];

export default function AdminLayout() {
  return <AppShell area="پنل مدیریت دانشگاه" nav={nav} />;
}
