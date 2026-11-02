import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ToastContainer from './components/ToastContainer';
import { ROLES } from './constants/roles';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import RootRedirect from './pages/RootRedirect';

import CreateTicketPage from './pages/CreateTicketPage';
import MyTicketsPage from './pages/MyTicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';

import AgentQueuePage from './pages/AgentQueuePage';
import AgentAssignedPage from './pages/AgentAssignedPage';

import AdminUsersPage from './pages/AdminUsersPage';
import AdminStatsPage from './pages/AdminStatsPage';
import AdminKnowledgeBaseUploadPage from './pages/AdminKnowledgeBaseUploadPage';
import AdminWeeklyInsightsPage from './pages/AdminWeeklyInsightsPage';
import AdminAuditLogPage from './pages/AdminAuditLogPage';

export default function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<RootRedirect />} />

        <Route element={<ProtectedRoute allowedRoles={[ROLES.USER]} />}>
          <Route path="/tickets/new" element={<CreateTicketPage />} />
          <Route path="/tickets/mine" element={<MyTicketsPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.AGENT]} />}>
          <Route path="/agent/queue" element={<AgentQueuePage />} />
          <Route path="/agent/assigned" element={<AgentAssignedPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/stats" element={<AdminStatsPage />} />
          <Route path="/admin/kb-upload" element={<AdminKnowledgeBaseUploadPage />} />
          <Route path="/admin/insights" element={<AdminWeeklyInsightsPage />} />
          <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
        </Route>

        {/* Any authenticated role can view a ticket's detail page - the
            backend itself restricts Users to their own tickets (403/404
            otherwise), Agents/Admins may view any. */}
        <Route
          element={
            <ProtectedRoute allowedRoles={[ROLES.USER, ROLES.AGENT, ROLES.ADMIN]} />
          }
        >
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Route>
      </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
