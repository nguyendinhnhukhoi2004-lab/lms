import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import QuestionBank from './pages/QuestionBank';
import ExamManagement from './pages/ExamManagement';
import ExamRoom from './pages/ExamRoom';
import Statistics from './pages/Statistics';
import GradeEssay from './pages/GradeEssay';
import NotFound from './pages/NotFound';
import Profile from './pages/Profile';
// Admin pages
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import ClassManagement from './pages/ClassManagement';
import SubjectManagement from './pages/SubjectManagement';
import Gradebook from './pages/Gradebook';

function AppContent() {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Giữ lại đường dẫn cuối cùng để có thể phục hồi khi refresh/đăng nhập lại
  const rawLastPath = window.localStorage.getItem('lastPath');
  const lastPath = rawLastPath && rawLastPath !== '/login' ? rawLastPath : '/dashboard';

  useEffect(() => {
    if (isAuthenticated && location.pathname !== '/login') {
      window.localStorage.setItem('lastPath', location.pathname);
    }
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const allPaths = getAppSections(user.role).flatMap(s => s.children ? s.children.map(c => c.path) : [s.path]);
      const allowedPaths = ['/dashboard', '/statistics', '/exam-room', '/question-bank', '/exams', '/grade-essay', '/grades', '/profile', '/login', '/'].concat(allPaths);
      
      // Allow parent path access if any child path matches
      if (!allowedPaths.includes(location.pathname) && !location.pathname.startsWith('/admin/users')) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [loading, isAuthenticated, user, location.pathname, navigate]);

  // Đợi AuthContext kiểm tra token xong mới render
  // Tránh các page gọi API trước khi có token → lỗi 401
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-slate-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  const getAppSections = (role) => {
    const IC = {
      dashboard:    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
      users:        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.37M9 20H4v-2a4 4 0 015-3.37m6 5.37a4 4 0 10-8 0m8 0H9m4-8a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
      head:         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A4 4 0 019 16h6a4 4 0 013.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      teacher:      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
      student:      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>,
      classes:      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8v-4a1 1 0 011-1h2a1 1 0 011 1v4m-4 0h4" /></svg>,
      subjects:     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
      stats:        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      questions:    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      exams:        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      grade:        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
      gradebook:    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
      examroom:     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
    };
    switch (role) {
      case 'admin':
        return [
          { path: '/dashboard',       label: 'Tổng quan',       icon: IC.dashboard },
          {
            label: 'Người dùng', icon: IC.users,
            children: [
              { path: '/admin/users/heads',    label: 'Tổ trưởng', icon: IC.head },
              { path: '/admin/users/teachers', label: 'Giáo viên', icon: IC.teacher },
              { path: '/admin/users/students', label: 'Học sinh',  icon: IC.student },
            ]
          },
          { path: '/admin/classes',   label: 'Lớp hành chính',  icon: IC.classes },
          { path: '/admin/subjects',  label: 'Môn học',          icon: IC.subjects },
          { path: '/statistics',      label: 'Thống kê',         icon: IC.stats },
        ];
      case 'department_head':
        return [
          { path: '/dashboard',       label: 'Tổng quan',          icon: IC.dashboard },
          { path: '/question-bank',   label: 'Ngân hàng câu hỏi',  icon: IC.questions },
          { path: '/exams',           label: 'Quản lý đề thi',     icon: IC.exams },
          { path: '/grade-essay',     label: 'Chấm tự luận',       icon: IC.grade },
          { path: '/grades',          label: 'Sổ điểm',            icon: IC.gradebook },
          { path: '/statistics',      label: 'Thống kê',           icon: IC.stats },
        ];
      case 'teacher':
        return [
          { path: '/dashboard',       label: 'Tổng quan',          icon: IC.dashboard },
          { path: '/question-bank',   label: 'Ngân hàng câu hỏi',  icon: IC.questions },
          { path: '/exams',           label: 'Quản lý đề thi',     icon: IC.exams },
          { path: '/grade-essay',     label: 'Chấm tự luận',       icon: IC.grade },
          { path: '/grades',          label: 'Sổ điểm',            icon: IC.gradebook },
          { path: '/statistics',      label: 'Thống kê',           icon: IC.stats },
        ];
      case 'student':
        return [
          { path: '/dashboard',       label: 'Tổng quan',  icon: IC.dashboard },
          { path: '/exam-room',       label: 'Phòng thi',  icon: IC.examroom },
          { path: '/statistics',      label: 'Kết quả thi',icon: IC.stats },
        ];
      default:
        return [{ path: '/dashboard', label: 'Tổng quan', icon: IC.dashboard }];
    }
  };

  const appSections = user ? getAppSections(user.role) : [];

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const roleLabel = {
    admin: 'Quản trị viên',
    department_head: 'Tổ trưởng',
    teacher: 'Giáo viên',
    student: 'Học sinh',
  }[user?.role] || '';

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
      <Sidebar sections={appSections} />

      <main className="flex-1 p-4 md:p-6">
        <header className="mb-6 rounded-3xl border border-brand-100 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-brand-500">Hệ thống quản lý thi</p>
              <h1 className="text-3xl font-semibold text-brand-900">{user?.full_name || 'Bảng điều khiển'}</h1>
            </div>
            <div className="rounded-2xl bg-brand-50 px-4 py-2 text-sm text-slate-700 shadow-inner">
              Vai trò: <span className="font-semibold">{roleLabel}</span>
            </div>
          </div>
        </header>

        <Routes>
          {/* Dashboard */}
          <Route path="/dashboard" element={user?.role === 'admin' ? <AdminDashboard /> : <Dashboard />} />

          {/* Chung */}
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/profile"    element={<Profile />} />

          {/* Admin */}
          {user?.role === 'admin' && (
            <>
              <Route path="/admin/users/heads"    element={<UserManagement defaultRole="department_head" />} />
              <Route path="/admin/users/teachers" element={<UserManagement defaultRole="teacher" />} />
              <Route path="/admin/users/students" element={<UserManagement defaultRole="student" />} />
              <Route path="/admin/users"          element={<Navigate to="/admin/users/students" replace />} />
              <Route path="/admin/classes"  element={<ClassManagement />} />
              <Route path="/admin/subjects" element={<SubjectManagement />} />
            </>
          )}

          {/* Giáo viên & Tổ trưởng */}
          {(user?.role === 'department_head' || user?.role === 'teacher') && (
            <>
              <Route path="/question-bank" element={<QuestionBank />} />
              <Route path="/exams"         element={<ExamManagement />} />
              <Route path="/grade-essay"   element={<GradeEssay />} />
              <Route path="/grades"        element={<Gradebook />} />
            </>
          )}

          {/* Học sinh */}
          {user?.role === 'student' && (
            <Route path="/exam-room" element={<ExamRoom />} />
          )}

          <Route path="/" element={<Navigate to={lastPath} replace />} />
          <Route path="*"  element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-brand-50 text-slate-900">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  );
}

export default App;
