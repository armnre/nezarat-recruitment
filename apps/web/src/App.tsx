import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from './lib/auth';
import LoginPage from './pages/LoginPage';
import ApplicantLayout from './pages/applicant/ApplicantLayout';
import DashboardPage from './pages/applicant/DashboardPage';
import ProfilePage from './pages/applicant/ProfilePage';
import ResumePage from './pages/applicant/ResumePage';
import CallsPage from './pages/applicant/CallsPage';
import CallDetailPage from './pages/applicant/CallDetailPage';
import ApplicationPage from './pages/applicant/ApplicationPage';
import CommitteeLayout, { canManage } from './pages/committee/CommitteeLayout';
import AssignmentsPage from './pages/committee/AssignmentsPage';
import DossierPage from './pages/committee/DossierPage';
import QueuePage from './pages/committee/QueuePage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import CallsAdminPage from './pages/admin/CallsAdminPage';
import CallEditorPage from './pages/admin/CallEditorPage';
import ApplicationsAdminPage from './pages/admin/ApplicationsAdminPage';
import MembersPage from './pages/admin/MembersPage';
import OrgPage from './pages/admin/OrgPage';
import ReportsPage from './pages/admin/ReportsPage';
import TemplatesPage from './pages/admin/TemplatesPage';
import PlatformLayout from './pages/platform/PlatformLayout';
import TenantsPage from './pages/platform/TenantsPage';
import PlatformUsersPage from './pages/platform/PlatformUsersPage';
import PerformancePage from './pages/platform/PerformancePage';
import { Skeleton } from './components/ui';

function FullPageLoader() {
  return <div className="container max-w-4xl space-y-4 py-10"><Skeleton className="h-10 w-48" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
}

/** Sends each role to its home panel. */
function Home() {
  const { data: me } = useMe();
  if (!me) return <Navigate to="/login" replace />;
  if (me.roles.includes('super_admin')) return <Navigate to="/platform" replace />;
  if (me.roles.includes('university_admin')) return <Navigate to="/admin" replace />;
  if (me.roles.includes('committee_member') || me.roles.includes('committee_chair')) return <Navigate to="/committee" replace />;
  if (canManage(me.permissions)) return <Navigate to="/committee/queue" replace />;
  if (me.roles.includes('applicant')) return <Navigate to="/applicant" replace />;
  return <Navigate to="/login" replace />;
}

function RequireRole({ role, children }: { role: string | string[]; children: React.ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <FullPageLoader />;
  if (!me) return <Navigate to="/login" replace />;
  if (![role].flat().some((r) => me.roles.includes(r as never))) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isLoading } = useMe();
  if (isLoading) return <FullPageLoader />;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/applicant" element={<RequireRole role="applicant"><ApplicantLayout /></RequireRole>}>
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="calls/:id" element={<CallDetailPage />} />
        <Route path="applications/:id" element={<ApplicationPage />} />
      </Route>
      <Route path="/committee" element={<RequireRole role={['committee_member', 'committee_chair', 'university_admin']}><CommitteeLayout /></RequireRole>}>
        <Route index element={<AssignmentsPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="applications/:id" element={<DossierPage />} />
      </Route>
      <Route path="/admin" element={<RequireRole role="university_admin"><AdminLayout /></RequireRole>}>
        <Route index element={<AdminDashboard />} />
        <Route path="calls" element={<CallsAdminPage />} />
        <Route path="calls/:id" element={<CallEditorPage />} />
        <Route path="applications" element={<ApplicationsAdminPage />} />
        <Route path="applications/:id" element={<DossierPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="org" element={<OrgPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route path="/platform" element={<RequireRole role="super_admin"><PlatformLayout /></RequireRole>}>
        <Route index element={<TenantsPage />} />
        <Route path="users" element={<PlatformUsersPage />} />
        <Route path="performance" element={<PerformancePage />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
