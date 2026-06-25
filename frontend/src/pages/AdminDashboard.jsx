import { useState, useEffect } from 'react';
import { statisticsService, healthService } from '../services/api';

const StatCard = ({ label, value, sub, color = 'blue' }) => {
  const colors = { blue: 'text-blue-600', green: 'text-green-600', yellow: 'text-yellow-600', purple: 'text-purple-600', red: 'text-red-600' };
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${colors[color]}`}>{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
};

const ServiceBadge = ({ name, status, loading }) => {
  const ok = status === 'ok';
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 ${ok ? 'bg-green-50' : loading ? 'bg-slate-50' : 'bg-red-50'}`}>
      <div className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : loading ? 'bg-slate-300 animate-pulse' : 'bg-red-500'}`} />
      <div>
        <p className={`text-sm font-semibold ${ok ? 'text-green-800' : loading ? 'text-slate-600' : 'text-red-800'}`}>{name}</p>
        <p className={`text-xs ${ok ? 'text-green-600' : loading ? 'text-slate-400' : 'text-red-600'}`}>
          {loading ? 'Đang kiểm tra...' : ok ? 'Hoạt động bình thường' : 'Không phản hồi'}
        </p>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    statisticsService.getAdminOverview()
      .then(setStats)
      .catch(() => setError('Không thể tải thống kê tổng quan'))
      .finally(() => setLoading(false));

    healthService.check()
      .then(setHealth)
      .catch(() => setHealth({ services: { database: 'error', nlp: 'error' } }))
      .finally(() => setHealthLoading(false));

    // Refresh health mỗi 30 giây
    const id = setInterval(() => {
      healthService.check().then(setHealth).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="py-12 text-center text-slate-400">Đang tải thống kê...</div>;
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>;

  const totalUsers = (stats?.total_students || 0) + (stats?.total_teachers || 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Bảng điều khiển Admin</h2>
        <p className="text-sm text-slate-500">Tổng quan hệ thống — dữ liệu thời gian thực</p>
      </div>

      {/* Thống kê tổng */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tổng người dùng" value={totalUsers} sub={`${stats?.total_students || 0} HS · ${stats?.total_teachers || 0} GV`} color="blue" />
        <StatCard label="Tổng lớp học" value={stats?.total_classes} color="green" />
        <StatCard label="Câu hỏi đã duyệt" value={stats?.approved_questions} sub={`${stats?.pending_questions || 0} chờ duyệt`} color="purple" />
        <StatCard label="Đề thi đã duyệt" value={stats?.approved_exams} color="yellow" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Hoạt động */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Hoạt động thi cử</h3>
          <div className="space-y-3">
            {[
              { label: 'Đang diễn ra', value: stats?.active_exams_now || 0, dot: 'bg-green-500' },
              { label: 'Tổng bài đã nộp', value: stats?.total_submissions || 0, dot: 'bg-blue-500' },
              { label: 'Câu hỏi chờ duyệt', value: stats?.pending_questions || 0, dot: 'bg-yellow-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                  <span className="text-sm text-slate-700">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tình trạng hệ thống */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Tình trạng hệ thống</h3>
            <span className="text-xs text-slate-400">Tự động cập nhật mỗi 30s</span>
          </div>
          <div className="space-y-3">
            <ServiceBadge name="Database (PostgreSQL)" status={health?.services?.database} loading={healthLoading} />
            <ServiceBadge name="NLP Service (Python)" status={health?.services?.nlp} loading={healthLoading} />
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <div>
                <p className="text-sm font-semibold text-blue-800">API Server (Node.js)</p>
                <p className="text-xs text-blue-600">Hoạt động bình thường</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
