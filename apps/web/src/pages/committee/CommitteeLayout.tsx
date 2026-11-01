import { ClipboardList, Users } from 'lucide-react';
import { useMe } from '../../lib/auth';
import AppShell, { type NavItem } from '../../components/AppShell';

export const canManage = (perms: string[] = []) => perms.includes('evaluations.finalize') || perms.includes('members.manage');

export default function CommitteeLayout() {
  const { data: me } = useMe();
  const nav: NavItem[] = [
    { to: '/committee', label: 'کارتابل ارزیابی', icon: ClipboardList, end: true },
    ...(canManage(me?.permissions) ? [{ to: '/committee/queue', label: 'مدیریت کمیته', icon: Users }] : []),
  ];
  return <AppShell area="کمیتهٔ جذب" nav={nav} />;
}
