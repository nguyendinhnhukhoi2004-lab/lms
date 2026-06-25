import { useState, useEffect } from 'react';
import { submissionService, examService } from '../services/api';
import MathViewer from '../components/MathViewer';

// ── Hiển thị câu trả lời tự luận của học sinh ────────────────────
const EssayCard = ({ answer, index, onGrade, saving }) => {
  const [score, setScore] = useState(answer.final_score ?? answer.auto_score ?? '');
  const [changed, setChanged] = useState(false);
  const needsGrading = answer.similarity_score === -1 || answer.final_score === null;
  const autoGraded   = answer.similarity_score !== null && answer.similarity_score !== -1;

  const handleSave = async () => {
    const val = parseFloat(score);
    if (isNaN(val) || val < 0 || val > answer.max_score) {
      alert(`Điểm phải từ 0 đến ${answer.max_score}`);
      return;
    }
    await onGrade(answer.question_id, val);
    setChanged(false);
  };

  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${needsGrading ? 'border-yellow-200' : 'border-slate-100'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{index}</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Câu tự luận</span>
            {needsGrading && (
              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">⚠ Cần chấm thủ công</span>
            )}
            {autoGraded && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                NLP: {Math.round((answer.similarity_score || 0) * 100)}% tương đồng
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-slate-800">
            <MathViewer htmlContent={answer.question_content} />
          </div>
        </div>
        <span className="shrink-0 text-xs text-slate-400">Tối đa: {answer.max_score}đ</span>
      </div>

      {/* Đáp án mẫu */}
      {answer.sample_answer && (
        <div className="mb-3 rounded-lg bg-green-50 p-3">
          <p className="mb-1 text-xs font-semibold text-green-700">Đáp án mẫu:</p>
          <div className="text-xs text-green-800 whitespace-pre-wrap">
            <MathViewer htmlContent={answer.sample_answer} />
          </div>
        </div>
      )}

      {/* Bài làm học sinh */}
      <div className="mb-4 rounded-lg bg-slate-50 p-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">Bài làm học sinh:</p>
        {answer.student_answer?.text ? (
          <div className="text-sm text-slate-800 whitespace-pre-wrap">
            <MathViewer htmlContent={answer.student_answer.text} />
          </div>
        ) : (
          <p className="text-xs italic text-slate-400">Học sinh không trả lời</p>
        )}
      </div>

      {/* Chấm điểm */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Điểm:</label>
        <input
          type="number"
          min={0}
          max={answer.max_score}
          step={0.25}
          value={score}
          onChange={e => { setScore(e.target.value); setChanged(true); }}
          className="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-center text-sm font-semibold focus:border-brand-400 focus:outline-none"
          placeholder="0.00"
        />
        <span className="text-sm text-slate-400">/ {answer.max_score}</span>
        {changed && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu điểm'}
          </button>
        )}
        {!changed && answer.final_score !== null && (
          <span className="text-xs text-green-600 font-medium">✓ Đã chấm: {answer.final_score}đ</span>
        )}
      </div>
    </div>
  );
};

// ── Danh sách bài nộp của 1 lịch thi ─────────────────────────────
const SubmissionList = ({ scheduleId, onSelect }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    submissionService.getClassResults(scheduleId)
      .then(r => setSubmissions(r || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scheduleId]);

  if (loading) return <div className="py-8 text-center text-sm text-slate-400">Đang tải danh sách...</div>;
  if (!submissions.length) return <div className="py-8 text-center text-sm text-slate-400">Chưa có bài nộp nào</div>;

  return (
    <div className="space-y-2">
      {submissions.map(s => {
        const pct = s.max_score ? Math.round((s.total_score / s.max_score) * 100) : 0;
        const hasEssay = s.has_essay_pending;
        return (
          <button key={s.submission_id} onClick={() => onSelect(s)}
            className="w-full flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 text-left hover:border-brand-200 hover:bg-brand-50 transition shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-800">{s.student_name}</p>
              <p className="text-xs text-slate-400">{s.class_name} · Nộp {new Date(s.submitted_at).toLocaleString('vi-VN')}</p>
            </div>
            <div className="flex items-center gap-3">
              {hasEssay && (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Chờ chấm TL</span>
              )}
              <div className="text-right">
                <p className={`text-sm font-bold ${pct >= 65 ? 'text-green-600' : 'text-red-500'}`}>
                  {s.total_score}/{s.max_score}
                </p>
                <p className="text-xs text-slate-400">{pct}%</p>
              </div>
              <span className="text-slate-300">›</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// ── Trang chính ───────────────────────────────────────────────────
const GradeEssay = () => {
  const [exams, setExams]               = useState([]);
  const [schedules, setSchedules]       = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [essayAnswers, setEssayAnswers] = useState([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [savingId, setSavingId]         = useState(null);
  const [loadingExams, setLoadingExams] = useState(true);

  // Load đề thi đã duyệt
  useEffect(() => {
    examService.getAll({ status: 'approved' })
      .then(d => setExams(d.exams || d || []))
      .catch(() => {})
      .finally(() => setLoadingExams(false));
  }, []);

  // Load lịch thi khi chọn đề
  useEffect(() => {
    if (!selectedExam) { setSchedules([]); setSelectedSchedule(''); return; }
    examService.getSchedules({ exam_id: selectedExam })
      .then(s => setSchedules(s || []))
      .catch(() => {});
  }, [selectedExam]);

  // Load essay answers khi chọn bài nộp
  useEffect(() => {
    if (!selectedSubmission) { setEssayAnswers([]); return; }
    setLoadingAnswers(true);
    submissionService.getResult(selectedSubmission.submission_id)
      .then(data => {
        // Chỉ lấy câu tự luận
        const essays = (data.answers || []).filter(a => a.question_type === 'essay');
        setEssayAnswers(essays);
      })
      .catch(() => {})
      .finally(() => setLoadingAnswers(false));
  }, [selectedSubmission]);

  const handleGrade = async (questionId, finalScore) => {
    setSavingId(questionId);
    try {
      const subId = selectedSubmission.submission_id;
      await submissionService.gradeEssay(subId, questionId, finalScore);
      // Cập nhật điểm local
      setEssayAnswers(prev =>
        prev.map(a => a.question_id === questionId ? { ...a, final_score: finalScore } : a)
      );
    } catch (e) {
      alert('Lỗi lưu điểm: ' + e.message);
    } finally {
      setSavingId(null);
    }
  };

  const essaysPending = essayAnswers.filter(a => a.similarity_score === -1 || a.final_score === null).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Chấm tự luận</h2>
        <p className="text-sm text-slate-500">Xem và chấm điểm câu tự luận cho từng bài nộp</p>
      </div>

      {/* Bộ chọn đề thi → lịch thi */}
      <div className="grid gap-4 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Đề thi</label>
          {loadingExams ? <p className="text-sm text-slate-400">Đang tải...</p> : (
            <select value={selectedExam} onChange={e => { setSelectedExam(e.target.value); setSelectedSchedule(''); setSelectedSubmission(null); }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
              <option value="">-- Chọn đề thi --</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lịch thi / Lớp</label>
          <select value={selectedSchedule}
            onChange={e => { setSelectedSchedule(e.target.value); setSelectedSubmission(null); }}
            disabled={!selectedExam || !schedules.length}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400">
            <option value="">-- Chọn lịch thi --</option>
            {schedules.map(s => (
              <option key={s.id} value={s.id}>
                {s.class_name} · {new Date(s.start_time).toLocaleDateString('vi-VN')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Nội dung chính: 2 cột */}
      {selectedSchedule && (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          {/* Cột trái: danh sách bài nộp */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Danh sách bài nộp</h3>
            <SubmissionList
              scheduleId={selectedSchedule}
              onSelect={s => { setSelectedSubmission(s); }}
            />
          </div>

          {/* Cột phải: chấm điểm */}
          <div>
            {!selectedSubmission ? (
              <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                <div className="text-center">
                  <p className="text-sm font-medium">Chọn một bài nộp để chấm</p>
                  <p className="mt-1 text-xs">Nhấn vào tên học sinh bên trái</p>
                </div>
              </div>
            ) : loadingAnswers ? (
              <div className="py-12 text-center text-slate-400">Đang tải bài làm...</div>
            ) : essayAnswers.length === 0 ? (
              <div className="rounded-xl bg-slate-50 py-12 text-center text-slate-400">
                Bài thi này không có câu tự luận
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-white px-5 py-3 shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{selectedSubmission.student_name}</p>
                    <p className="text-xs text-slate-400">{selectedSubmission.class_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Câu tự luận</p>
                    <p className="text-sm font-bold text-slate-700">
                      {essayAnswers.length - essaysPending}/{essayAnswers.length} đã chấm
                    </p>
                  </div>
                </div>

                {essayAnswers.map((a, i) => (
                  <EssayCard
                    key={a.question_id}
                    answer={a}
                    index={i + 1}
                    onGrade={handleGrade}
                    saving={savingId === a.question_id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GradeEssay;
