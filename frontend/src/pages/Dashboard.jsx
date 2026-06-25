import { useState, useEffect } from 'react';
import { statisticsService, examService, submissionService, teacherSubjectService } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Dashboard học sinh ────────────────────────────────────────────
const StudentDashboard = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    submissionService.getMyResults()
      .then(r => setResults(r || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avg = results.length
    ? (results.reduce((s, r) => s + (r.total_score / r.max_score) * 100, 0) / results.length).toFixed(1)
    : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Bài đã thi" value={results.length} color="blue" />
        <StatCard label="Điểm trung bình" value={avg ? `${avg}%` : '—'} color="green" />
        <StatCard label="Bài thi gần nhất"
          value={results[0] ? `${((results[0].total_score / results[0].max_score) * 100).toFixed(0)}%` : '—'} color="purple" />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-900">Lịch sử làm bài</h3>
        {loading ? <p className="text-sm text-slate-400">Đang tải...</p> :
          results.length === 0 ? <p className="text-sm text-slate-400">Chưa có bài thi nào</p> :
          <div className="space-y-2">
            {results.slice(0, 8).map(r => {
              const pct = Math.round((r.total_score / r.max_score) * 100);
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.exam_title || 'Bài thi'}</p>
                    <p className="text-xs text-slate-400">{new Date(r.submitted_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${pct >= 65 ? 'text-green-600' : 'text-red-500'}`}>
                      {r.total_score}/{r.max_score}
                    </p>
                    <p className="text-xs text-slate-400">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
};

// ── Dashboard giáo viên / tổ trưởng ──────────────────────────────
const TeacherDashboard = () => {
  const [stats, setStats] = useState(null);
  const [exams, setExams] = useState([]);
  const [mySubjects, setMySubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      statisticsService.getQuestionBankStats().then(setStats).catch(() => {}),
      examService.getAll().then(d => setExams((d.exams || d || []).slice(0, 5))).catch(() => {}),
      teacherSubjectService.getMySubjects().then(setMySubjects).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      {mySubjects.length > 0 && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-800 mb-2">Môn học đang phụ trách:</p>
          <div className="flex flex-wrap gap-2">
            {mySubjects.map(sub => (
              <span key={sub.id || sub.subject_name} className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-brand-700 shadow-sm border border-brand-100">
                {sub.subject_name} {sub.grade ? `(Khối ${sub.grade})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Câu hỏi của tôi" value={loading ? '…' : (stats?.my_questions ?? '—')} color="blue" />
        <StatCard label="Câu đã duyệt" value={loading ? '…' : (stats?.approved_questions ?? '—')} color="green" />
        <StatCard label="Câu chờ duyệt" value={loading ? '…' : (stats?.pending_questions ?? '—')} color="yellow" />
        <StatCard label="Đề thi đã tạo" value={exams.length} color="purple" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Đề thi gần đây</h3>
          {loading ? <p className="text-sm text-slate-400">Đang tải...</p> :
            exams.length === 0 ? <p className="text-sm text-slate-400">Chưa có đề thi</p> :
            <div className="space-y-2">
              {exams.map(e => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-800 truncate">{e.title}</p>
                  <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.status === 'approved' ? 'bg-green-100 text-green-700' :
                    e.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-600'}`}>
                    {e.status === 'draft' ? 'Nháp' : e.status === 'pending_approval' ? 'Chờ duyệt' : 'Đã duyệt'}
                  </span>
                </div>
              ))}
            </div>
          }
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Thống kê ngân hàng câu hỏi</h3>
          {loading ? <p className="text-sm text-slate-400">Đang tải...</p> :
            !stats ? <p className="text-sm text-slate-400">Không có dữ liệu</p> :
            <div className="space-y-3">
              {[
                { label: 'Trắc nghiệm', value: stats.by_type?.multiple_choice ?? 0 },
                { label: 'Đúng/Sai', value: stats.by_type?.true_false ?? 0 },
                { label: 'Tự luận', value: stats.by_type?.essay ?? 0 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-slate-600">{item.label}</span>
                  <div className="flex-1 rounded-full bg-slate-100 h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-400 transition-all"
                      style={{ width: `${stats.total ? (item.value / stats.total) * 100 : 0}%` }} />
                  </div>
                  <span className="w-8 text-right text-xs font-medium text-slate-500">{item.value}</span>
                </div>
              ))}
            </div>
          }
        </div>
      </div>
    </div>
  );
};

// ── Stat card tái sử dụng ─────────────────────────────────────────
const COLORS = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  purple: 'bg-purple-50 text-purple-700',
};

const StatCard = ({ label, value, color = 'blue' }) => (
  <div className="rounded-xl bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${COLORS[color]?.split(' ')[1]}`}>{value}</p>
  </div>
);

// ── Component chính ───────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  return (
    <div className="space-y-1">
      {user?.role === 'student' ? <StudentDashboard /> : <TeacherDashboard />}
    </div>
  );
};

export default Dashboard;
