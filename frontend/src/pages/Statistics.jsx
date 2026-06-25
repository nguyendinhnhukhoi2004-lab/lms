import { useState, useEffect } from 'react';
import { statisticsService, examService } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Mini bar chart thuần CSS ──────────────────────────────────────
const BarChart = ({ data, maxValue }) => {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-semibold text-slate-600">{d.value}</span>
          <div className="w-full rounded-t bg-brand-400 transition-all" style={{ height: `${(d.value / max) * 100}px` }} />
          <span className="text-[10px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

const StatCard = ({ label, value, sub, icon, color = 'blue' }) => {
  const bg = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    yellow: 'from-amber-400 to-amber-500',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600',
  }[color] || 'from-blue-500 to-blue-600';

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex items-start gap-4">
      <div className={`rounded-xl bg-gradient-to-br ${bg} p-3 text-white text-xl shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{value ?? '—'}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
};

// ── Thống kê Admin ────────────────────────────────────────────────
const AdminStatistics = () => {
  const [overview, setOverview] = useState(null);
  const [qbStats, setQbStats] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [examSummary, setExamSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingExam, setLoadingExam] = useState(false);

  useEffect(() => {
    Promise.all([
      statisticsService.getAdminOverview(),
      statisticsService.getQuestionBankStats(),
      examService.getAll({ status: 'approved' }),
    ]).then(([ov, qb, exData]) => {
      setOverview(ov);
      setQbStats(Array.isArray(qb) ? qb : []);
      setExams(exData?.exams || exData || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSelectExam = async (examId) => {
    setSelectedExam(examId);
    setExamSummary(null);
    if (!examId) return;
    setLoadingExam(true);
    try {
      const schedules = await examService.getSchedules({ exam_id: examId });
      if (schedules?.length > 0) {
        const data = await statisticsService.getScheduleSummary(schedules[0].id);
        setExamSummary(data);
      }
    } catch { /* no data */ } finally { setLoadingExam(false); }
  };

  // Tổng hợp ngân hàng câu hỏi theo môn
  const subjectSummary = qbStats.reduce((acc, row) => {
    const key = `${row.subject_name} (K${row.grade})`;
    if (!acc[key]) acc[key] = { total: 0, approved: 0 };
    acc[key].total += row.count;
    return acc;
  }, {});
  const subjectArr = Object.entries(subjectSummary)
    .map(([label, v]) => ({ label, value: v.total }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Tổng hợp theo loại câu hỏi
  const typeMap = { multiple_choice: 'Trắc nghiệm', true_false: 'Đúng/Sai', essay: 'Tự luận', short_answer: 'Trả lời ngắn' };
  const typeSummary = qbStats.reduce((acc, row) => {
    const label = typeMap[row.type] || row.type;
    acc[label] = (acc[label] || 0) + row.count;
    return acc;
  }, {});

  if (loading) return <div className="py-12 text-center text-slate-400">Đang tải thống kê...</div>;

  const totalUsers = (overview?.total_students || 0) + (overview?.total_teachers || 0);
  const totalQuestions = qbStats.reduce((s, r) => s + r.count, 0);

  const scoreDistribution = examSummary ? [
    { label: 'Xuất sắc\n(≥90%)', value: examSummary.score_distribution?.excellent || 0 },
    { label: 'Giỏi\n(80–89%)', value: examSummary.score_distribution?.good || 0 },
    { label: 'Khá\n(65–79%)', value: examSummary.score_distribution?.above_avg || 0 },
    { label: 'TB\n(50–64%)', value: examSummary.score_distribution?.avg || 0 },
    { label: 'Yếu\n(<50%)', value: examSummary.score_distribution?.poor || 0 },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Tổng quan hệ thống */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Tổng quan hệ thống</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Học sinh" value={overview?.total_students ?? 0} icon="🎓" color="blue" />
          <StatCard label="Giáo viên" value={overview?.total_teachers ?? 0} icon="👩‍🏫" color="green" />
          <StatCard label="Lớp học" value={overview?.total_classes ?? 0} icon="🏫" color="indigo" />
          <StatCard label="Câu hỏi duyệt" value={overview?.approved_questions ?? 0} sub={`${overview?.pending_questions || 0} chờ duyệt`} icon="❓" color="purple" />
          <StatCard label="Đề thi duyệt" value={overview?.approved_exams ?? 0} icon="📋" color="yellow" />
          <StatCard label="Bài đã nộp" value={overview?.total_submissions ?? 0} icon="📝" color="red" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Ngân hàng câu hỏi theo môn */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Ngân hàng câu hỏi theo môn</h3>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{totalQuestions} câu đã duyệt</span>
          </div>
          {subjectArr.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {subjectArr.map((item) => {
                const pct = Math.round((item.value / subjectArr[0].value) * 100);
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs text-slate-600 truncate">{item.label}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-brand-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-slate-700">{item.value}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Chưa có câu hỏi nào được duyệt</p>
          )}
        </div>

        {/* Ngân hàng câu hỏi theo loại */}
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <h3 className="mb-4 font-semibold text-slate-900">Phân bổ theo loại câu hỏi</h3>
          {Object.keys(typeSummary).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(typeSummary).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                const total = Object.values(typeSummary).reduce((s, v) => s + v, 0);
                const pct = Math.round((count / total) * 100);
                const colors = {
                  'Trắc nghiệm': 'bg-blue-400',
                  'Đúng/Sai': 'bg-green-400',
                  'Tự luận': 'bg-purple-400',
                  'Trả lời ngắn': 'bg-amber-400',
                };
                return (
                  <div key={type}>
                    <div className="mb-1 flex justify-between text-xs text-slate-600">
                      <span className="font-medium">{type}</span>
                      <span>{count} câu ({pct}%)</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100">
                      <div className={`h-2.5 rounded-full ${colors[type] || 'bg-brand-400'} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Chưa có dữ liệu</p>
          )}
        </div>
      </div>

      {/* Thống kê chi tiết theo đề thi */}
      <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
        <h3 className="mb-4 font-semibold text-slate-900">Thống kê kết quả theo đề thi</h3>
        <select
          value={selectedExam}
          onChange={e => handleSelectExam(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none sm:w-96"
        >
          <option value="">— Chọn đề thi để xem thống kê —</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>

        {loadingExam && <div className="py-8 text-center text-slate-400 text-sm">Đang tải...</div>}

        {!loadingExam && selectedExam && !examSummary && (
          <div className="mt-4 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">
            Đề thi này chưa có lịch thi hoặc chưa có bài nộp
          </div>
        )}

        {examSummary && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Học sinh thi', value: examSummary.total_students || 0, icon: '👥', color: 'blue' },
                { label: 'Đã nộp bài', value: examSummary.submitted || 0, icon: '✅', color: 'green' },
                { label: 'Điểm TB', value: examSummary.avg_score != null ? parseFloat(examSummary.avg_score).toFixed(1) : '—', icon: '📊', color: 'purple' },
                { label: 'Tỉ lệ đạt (≥50%)', value: examSummary.pass_rate != null ? `${examSummary.pass_rate}%` : '—', icon: '🏆', color: 'yellow' },
              ].map(c => <StatCard key={c.label} {...c} />)}
            </div>

            {scoreDistribution.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-700">Phân bố điểm</h4>
                <BarChart data={scoreDistribution} />
              </div>
            )}

            {examSummary.results?.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-semibold text-slate-700">Bảng xếp hạng học sinh</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Học sinh</th>
                        <th className="px-4 py-2 text-left">Lớp</th>
                        <th className="px-4 py-2 text-right">Điểm</th>
                        <th className="px-4 py-2 text-right">%</th>
                        <th className="px-4 py-2 text-right">Xếp loại</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {examSummary.results.sort((a, b) => b.total_score - a.total_score).map((r, i) => {
                        const p = Math.round((r.total_score / r.max_score) * 100);
                        const grade = p >= 90 ? 'Xuất sắc' : p >= 80 ? 'Giỏi' : p >= 65 ? 'Khá' : p >= 50 ? 'Trung bình' : 'Yếu';
                        const gc = p >= 65 ? 'text-green-600' : 'text-red-500';
                        return (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-xs font-bold text-slate-400">#{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{r.student_name}</td>
                            <td className="px-4 py-3 text-slate-500">{r.class_name}</td>
                            <td className="px-4 py-3 text-right font-semibold">{r.total_score}/{r.max_score}</td>
                            <td className={`px-4 py-3 text-right font-bold ${gc}`}>{p}%</td>
                            <td className={`px-4 py-3 text-right text-xs font-semibold ${gc}`}>{grade}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Thống kê cho học sinh ────────────────────────────────────────
const StudentStatistics = () => {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statisticsService.getStudentSummary()
      .then(setProgress).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center text-slate-400">Đang tải...</div>;
  if (!progress) return <div className="py-12 text-center text-slate-400">Chưa có dữ liệu kết quả thi</div>;

  const pct = progress.total_exams ? Math.round((progress.avg_score / progress.max_possible) * 100) : 0;
  const recentArr = Array.isArray(progress.recent_results) ? progress.recent_results : [];
  const scoreHistory = recentArr.map(r => ({
    label: r.exam_title?.slice(0, 8) || '—',
    value: Math.round((r.total_score / r.max_score) * 100),
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Tổng số lần thi', value: progress.total_exams || 0, color: 'text-blue-600' },
          { label: 'Điểm TB (%)', value: pct ? `${pct}%` : '—', color: 'text-green-600' },
          { label: 'Điểm cao nhất', value: progress.best_score ? `${progress.best_score}/${progress.max_possible}` : '—', color: 'text-purple-600' },
          { label: 'Bài chưa chấm', value: progress.pending_manual || 0, color: 'text-yellow-600' },
        ].map(c => (
          <div key={c.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
            <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {scoreHistory.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Điểm (%) qua các lần thi gần nhất</h3>
          <BarChart data={scoreHistory} maxValue={100} />
        </div>
      )}

      {recentArr.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">Chi tiết kết quả</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs font-semibold uppercase text-slate-400 bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left">Đề thi</th>
                  <th className="px-4 py-2 text-left">Ngày nộp</th>
                  <th className="px-4 py-2 text-right">Điểm</th>
                  <th className="px-4 py-2 text-right">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentArr.map(r => {
                  const p = Math.round((r.total_score / r.max_score) * 100);
                  const dateValue = r.graded_at || r.submitted_at;
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.exam_title}</td>
                      <td className="px-4 py-3 text-slate-500">{dateValue ? new Date(dateValue).toLocaleString('vi-VN') : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{r.total_score}/{r.max_score}</td>
                      <td className={`px-4 py-3 text-right font-bold ${p >= 65 ? 'text-green-600' : 'text-red-500'}`}>{p}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Thống kê cho giáo viên / tổ trưởng ──────────────────────────
const TeacherStatistics = () => {
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);

  useEffect(() => {
    examService.getAll({ status: 'approved' })
      .then(d => setExams(d.exams || d || []))
      .catch(() => {})
      .finally(() => setLoadingExams(false));
  }, []);

  const handleSelectExam = async (examId) => {
    setSelectedExam(examId);
    if (!examId) { setSummary(null); return; }
    setLoading(true);
    try {
      const schedules = await examService.getSchedules({ exam_id: examId });
      if (schedules?.length > 0) {
        const data = await statisticsService.getScheduleSummary(schedules[0].id);
        setSummary(data);
      } else {
        setSummary(null);
      }
    } catch { setSummary(null); } finally { setLoading(false); }
  };

  const scoreDistribution = summary ? [
    { label: 'Xuất sắc (≥90%)', value: summary.score_distribution?.excellent || 0 },
    { label: 'Giỏi (80-89%)', value: summary.score_distribution?.good || 0 },
    { label: 'Khá (65-79%)', value: summary.score_distribution?.above_avg || 0 },
    { label: 'TB (50-64%)', value: summary.score_distribution?.avg || 0 },
    { label: 'Yếu (<50%)', value: summary.score_distribution?.poor || 0 },
  ] : [];

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-2">Chọn đề thi để xem thống kê</label>
        {loadingExams ? (
          <p className="text-sm text-slate-400">Đang tải danh sách đề thi...</p>
        ) : (
          <select value={selectedExam} onChange={e => handleSelectExam(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none sm:w-96">
            <option value="">-- Chọn đề thi --</option>
            {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="py-8 text-center text-slate-400">Đang tải thống kê...</div>}

      {!loading && selectedExam && !summary && (
        <div className="rounded-xl bg-slate-50 py-12 text-center text-slate-400">Đề thi này chưa có lịch thi hoặc chưa có bài nộp</div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Số học sinh thi', value: summary.total_students || 0, color: 'text-blue-600' },
              { label: 'Đã nộp bài', value: summary.submitted || 0, color: 'text-green-600' },
              { label: 'Điểm trung bình', value: summary.avg_score != null ? `${parseFloat(summary.avg_score).toFixed(1)}` : '—', color: 'text-purple-600' },
              { label: 'Tỉ lệ đạt (≥50%)', value: summary.pass_rate != null ? `${summary.pass_rate}%` : '—', color: 'text-yellow-600' },
            ].map(c => (
              <div key={c.label} className="rounded-xl bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
                <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {scoreDistribution.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-5 font-semibold text-slate-900">Phân bố điểm</h3>
              <BarChart data={scoreDistribution} />
            </div>
          )}

          {summary.results?.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Danh sách kết quả học sinh</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-2 text-left">Học sinh</th>
                      <th className="px-4 py-2 text-left">Lớp</th>
                      <th className="px-4 py-2 text-right">Điểm</th>
                      <th className="px-4 py-2 text-right">%</th>
                      <th className="px-4 py-2 text-right">Xếp loại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.results.sort((a, b) => b.total_score - a.total_score).map((r, i) => {
                      const p = Math.round((r.total_score / r.max_score) * 100);
                      const grade = p >= 90 ? 'Xuất sắc' : p >= 80 ? 'Giỏi' : p >= 65 ? 'Khá' : p >= 50 ? 'Trung bình' : 'Yếu';
                      const gc = p >= 65 ? 'text-green-600' : 'text-red-500';
                      return (
                        <tr key={r.id}>
                          <td className="px-4 py-3">
                            <span className="mr-2 text-xs text-slate-400">#{i + 1}</span>
                            {r.student_name}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{r.class_name}</td>
                          <td className="px-4 py-3 text-right font-semibold">{r.total_score}/{r.max_score}</td>
                          <td className={`px-4 py-3 text-right font-bold ${gc}`}>{p}%</td>
                          <td className={`px-4 py-3 text-right text-xs font-medium ${gc}`}>{grade}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Component chính ───────────────────────────────────────────────
const Statistics = () => {
  const { user } = useAuth();

  const title = user?.role === 'student'
    ? 'Kết quả thi của tôi'
    : user?.role === 'admin'
      ? 'Thống kê & Báo cáo toàn trường'
      : 'Thống kê & Báo cáo';

  const subtitle = user?.role === 'student'
    ? 'Theo dõi tiến độ học tập'
    : user?.role === 'admin'
      ? 'Tổng quan hệ thống, ngân hàng câu hỏi và kết quả kỳ thi'
      : 'Phân tích kết quả bài thi theo đề';

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      {user?.role === 'student' && <StudentStatistics />}
      {user?.role === 'admin' && <AdminStatistics />}
      {(user?.role === 'teacher' || user?.role === 'department_head') && <TeacherStatistics />}
    </div>
  );
};

export default Statistics;
