import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import AuthPage from '@/pages/AuthPage';
import TeacherDashboard from '@/pages/TeacherDashboard';
import StudentDashboard from '@/pages/StudentDashboard';
import AdminDashboard from '@/pages/AdminDashboard';

const Index = () => {
  const { user, profile, hasRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <DashboardLayout>
      {hasRole('admin') ? (
        <AdminDashboard />
      ) : profile?.role === 'teacher' ? (
        <TeacherDashboard />
      ) : (
        <StudentDashboard />
      )}
    </DashboardLayout>
  );
};

const WrappedIndex = () => (
  <AuthProvider>
    <Index />
  </AuthProvider>
);

export default WrappedIndex;
