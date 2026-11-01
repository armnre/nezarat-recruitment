import { BookOpen, LayoutDashboard, Megaphone, UserRound } from 'lucide-react';
import AppShell, { type NavItem } from '../../components/AppShell';

const nav: NavItem[] = [
  { to: '/applicant', label: 'پیشخوان', icon: LayoutDashboard, end: true },
  { to: '/applicant/profile', label: 'پرونده', icon: UserRound },
  { to: '/applicant/resume', label: 'رزومه علمی', icon: BookOpen },
  { to: '/applicant/calls', label: 'فراخوان‌ها', icon: Megaphone },
];

export default function ApplicantLayout() {
  return <AppShell area="پنل متقاضی" nav={nav} bottomNav />;
}
