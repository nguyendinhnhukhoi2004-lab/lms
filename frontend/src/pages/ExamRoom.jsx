import { useState, useEffect, useRef, useCallback } from 'react';
import { submissionService, examService } from '../services/api';
import MathViewer from '../components/MathViewer';

// ── Timer ──────────────────────────────────────────────────────────
const useCountdown = (endTime, onExpire) => {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!endTime) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(endTime) - Date.now()) / 1000));
      setRemaining(diff);
      if (diff === 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, onExpire]);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  return { remaining, display: `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, urgent: remaining < 300 };
};

// ── Màn hình chọn lịch thi (thay thế nhập mã thủ công) ───────────
const ScheduleListScreen = ({ onEnter, loading, error }) => {
  const [schedules, setSchedules] = useState([]);
  const [fetching, setFetching]   = useState(true);
  const [fetchErr, setFetchErr]   = useState('');
  const now = new Date();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await examService.getSchedules({ is_active: 'true' });
        setSchedules(Array.isArray(data) ? data : data.schedules || []);
      } catch (e) { setFetchErr(e.message); }
      finally { setFetching(false); }
    };
    load();
  }, []);

  const upcoming = schedules.filter(s => new Date(s.end_time) > now);
  const past     = schedules.filter(s => new Date(s.end_time) <= now);

  const getStatus = (s) => {
    const start = new Date(s.start_time);
    const end   = new Date(s.end_time);
    if (now < start) return { label: 'Sắp diễn ra', color: 'bg-amber-100 text-amber-700', canEnter: false };
    if (now >= start && now <= end) return { label: 'Đang diễn ra', color: 'bg-emerald-100 text-emerald-700', canEnter: true };
    return { label: 'Đã kết thúc', color: 'bg-slate-100 text-slate-500', canEnter: false };
  };

  const fmtTime = (t) => new Date(t).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  if (fetching) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 mx-auto" />
          <p className="text-sm">Đang tải lịch thi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(error || fetchErr) && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || fetchErr}</div>
      )}

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="rounded-2xl bg-white py-20 text-center shadow-sm">
          <div className="mb-3 text-5xl">📋</div>
          <p className="text-slate-500 font-medium">Chưa có lịch thi nào cho lớp bạn</p>
          <p className="mt-1 text-sm text-slate-400">Giáo viên sẽ thông báo khi có lịch thi mới</p>
        </div>
      ) : (
        <>
          {/* Lịch thi sắp/đang diễn ra */}
          {upcoming.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Lịch thi ({upcoming.length})
              </h3>
              <div className="space-y-3">
                {upcoming.map(s => {
                  const status = getStatus(s);
                  return (
                    <div key={s.id}
                      className={`rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md
                        ${status.canEnter ? 'border-2 border-emerald-400' : 'border border-slate-100'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
                              {status.label}
                            </span>
                            {status.canEnter && (
                              <span className="animate-pulse rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                                ● LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-base font-bold text-slate-900">{s.exam_title}</p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {s.subject_name} · {s.duration_minutes} phút
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>🕐 Bắt đầu: {fmtTime(s.start_time)}</span>
                            <span>🏁 Kết thúc: {fmtTime(s.end_time)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onEnter(s.id)}
                          disabled={!status.canEnter || loading}
                          className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition
                            ${status.canEnter
                              ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                          {loading ? '...' : status.canEnter ? 'Vào thi →' : 'Chưa mở'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lịch thi đã kết thúc */}
          {past.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Đã kết thúc ({past.length})
              </h3>
              <div className="space-y-2">
                {past.slice(0, 5).map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-600">{s.exam_title}</p>
                      <p className="text-xs text-slate-400">{fmtTime(s.end_time)}</p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-500">Đã kết thúc</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Màn hình kết quả ──────────────────────────────────────────────
const REVIEW_MODE_LABELS = {
  after_submit: '✅ Xem ngay sau khi nộp',
  after_close:  '🔒 Xem sau khi đề đóng',
  never:        '🚫 Không cho xem lại',
};

const ResultScreen = ({ result, answers, review, onBack }) => {
  const [showReview, setShowReview] = useState(false);
  const pct = result ? Math.round((result.total_score / result.max_score) * 100) : 0;
  const grade = pct >= 90 ? { label: 'Xuất sắc', color: 'text-green-600', bg: 'bg-green-50' }
    : pct >= 80 ? { label: 'Giỏi',        color: 'text-blue-600',   bg: 'bg-blue-50' }
    : pct >= 65 ? { label: 'Khá',          color: 'text-yellow-600', bg: 'bg-yellow-50' }
    : pct >= 50 ? { label: 'Trung bình',   color: 'text-orange-600', bg: 'bg-orange-50' }
    :             { label: 'Yếu',          color: 'text-red-600',    bg: 'bg-red-50' };

  const canReview = review?.can_review;
  const reviewMode = review?.review_mode;

  // Hàm render đáp án đúng cho từng loại câu
  const renderCorrectAnswer = (a) => {
    if (!a.correct_answer) return null;
    const ca = a.correct_answer;
    if (a.question_type === 'multiple_choice') {
      const correct = ca.selected || [];
      const opts = Array.isArray(a.options) ? a.options : [];
      return (
        <div className="mt-2 text-xs text-slate-600">
          <span className="font-medium text-emerald-700">Đáp án đúng: </span>
          {correct.map((id, idx) => {
            const opt = opts.find(o => o.id === id);
            return (
              <span key={id}>
                {idx > 0 && ', '}
                {id}. {opt ? <MathViewer htmlContent={opt.text} className="inline" /> : null}
              </span>
            );
          })}
        </div>
      );
    }
    if (a.question_type === 'true_false') {
      const answers_map = ca.answers || {};
      const opts = Array.isArray(a.options) ? a.options : [];
      return (
        <div className="mt-2 space-y-1">
          {opts.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`font-semibold ${answers_map[opt.id] ? 'text-emerald-600' : 'text-red-600'}`}>
                {answers_map[opt.id] ? '✓ Đúng' : '✗ Sai'}
              </span>
              <span className="text-slate-600">
                <MathViewer htmlContent={opt.statement} className="inline" />
              </span>
            </div>
          ))}
        </div>
      );
    }
    if (a.question_type === 'essay') {
      return (
        <div className="mt-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="font-medium mb-1">Đáp án mẫu:</p>
          <div className="whitespace-pre-line">
            <MathViewer htmlContent={ca.sample} />
          </div>
          {ca.keywords?.length > 0 && (
            <p className="mt-1 text-slate-500">Từ khóa: {ca.keywords.join(', ')}</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Hiển thị đáp án học sinh đã chọn
  const renderStudentAnswer = (a) => {
    const sa = a.student_answer;
    if (!sa) return <span className="text-slate-400 italic">Bỏ qua</span>;
    if (a.question_type === 'multiple_choice') {
      const selected = sa.selected || [];
      const opts = Array.isArray(a.options) ? a.options : [];
      return (
        <span className="text-slate-700">
          {selected.map((id, idx) => {
            const opt = opts.find(o => o.id === id);
            return (
              <span key={id}>
                {idx > 0 && ', '}
                {id}. {opt ? <MathViewer htmlContent={opt.text} className="inline" /> : null}
              </span>
            );
          })}
        </span>
      );
    }
    if (a.question_type === 'true_false') {
      const answers_map = sa.answers || {};
      return (
        <span className="text-slate-700">
          {Object.entries(answers_map).map(([k, v]) => `${k}:${v ? 'Đ' : 'S'}`).join(', ')}
        </span>
      );
    }
    if (a.question_type === 'essay') {
      return <span className="text-slate-700 whitespace-pre-line">{sa.text || ''}</span>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Điểm tổng */}
      <div className={`rounded-2xl ${grade.bg} p-8 text-center`}>
        <p className="text-sm font-medium text-slate-500">Kết quả bài thi</p>
        <p className={`mt-2 text-6xl font-bold ${grade.color}`}>
          {result?.total_score ?? '?'}<span className="text-3xl">/{result?.max_score}</span>
        </p>
        <p className={`mt-2 text-lg font-semibold ${grade.color}`}>{grade.label} — {pct}%</p>
        {result?.note && <p className="mt-3 text-sm text-slate-600 italic">{result.note}</p>}
      </div>

      {/* Điểm từng câu */}
      {answers?.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Chi tiết từng câu</h3>
            {canReview && (
              <button onClick={() => setShowReview(v => !v)}
                className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                {showReview ? '🙈 Ẩn đáp án' : '👁 Xem đáp án đúng'}
              </button>
            )}
            {!canReview && reviewMode === 'after_close' && (
              <span className="text-xs text-slate-400">🔒 Đáp án sẽ hiển thị sau khi đề đóng</span>
            )}
            {!canReview && reviewMode === 'never' && (
              <span className="text-xs text-slate-400">🚫 Giáo viên không cho xem đáp án</span>
            )}
          </div>

          <div className="space-y-3">
            {answers.map((a, i) => {
              const earned  = parseFloat(a.final_score ?? a.auto_score ?? 0);
              const max     = parseFloat(a.max_score ?? 0);
              const correct = earned >= max && max > 0;
              const partial = earned > 0 && earned < max;

              return (
                <div key={a.question_id}
                  className={`rounded-xl border p-4 ${correct ? 'border-green-200 bg-green-50' : partial ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                  {/* Header câu */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800 text-sm">Câu {i + 1}</span>
                        {a.question_type && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                            {a.question_type === 'multiple_choice' ? 'Trắc nghiệm'
                              : a.question_type === 'true_false' ? 'Đúng/Sai' : 'Tự luận'}
                          </span>
                        )}
                      </div>
                      {showReview && a.question_content && (
                        <p className="text-sm text-slate-700 mb-2">{a.question_content}</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-sm font-bold ${correct ? 'text-green-700' : partial ? 'text-amber-700' : 'text-red-700'}`}>
                      {earned}/{max}đ
                    </span>
                  </div>

                  {/* Xem lại đáp án */}
                  {showReview && (
                    <div className="mt-2 space-y-2 border-t border-slate-200 pt-2">
                      <div className="text-xs">
                        <span className="font-medium text-slate-600">Bài làm của bạn: </span>
                        {renderStudentAnswer(a)}
                      </div>
                      {!correct && renderCorrectAnswer(a)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button onClick={onBack} className="w-full rounded-lg border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50">
        Quay về
      </button>
    </div>
  );
};

// ── Màn hình làm bài ──────────────────────────────────────────────
const ExamScreen = ({ submissionId, examInfo, questions, savedAnswers, onSubmitDone }) => {
  const [answers, setAnswers] = useState(() => {
    const init = {};
    savedAnswers?.forEach(a => { init[a.question_id] = a.student_answer; });
    return init;
  });
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const saveTimeoutRef = useRef({});

  const { display, urgent, remaining } = useCountdown(examInfo?.end_time, async () => {
    if (submissionId && status === 'in_progress') {
      try {
        await submissionService.submit(submissionId);
        setStatus('submitted');
        alert('⏰ Hết giờ! Bài thi đã được tự động nộp.');
        // Refresh page or trigger done state
        window.location.reload();
      } catch (e) {
        console.error('Auto-submit failed:', e);
      }
    }
  });

  // Auto-save debounced
  const saveAnswer = useCallback(async (questionId, answer) => {
    try {
      setSaving(true);
      await submissionService.saveAnswer(submissionId, questionId, answer);
    } catch (e) {
      console.error('Auto-save lỗi:', e.message);
    } finally {
      setSaving(false);
    }
  }, [submissionId]);

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    // Debounce 1 giây
    clearTimeout(saveTimeoutRef.current[questionId]);
    saveTimeoutRef.current[questionId] = setTimeout(() => saveAnswer(questionId, answer), 1000);
  };

  const handleTrueFalseAnswer = (questionId, statementId, value) => {
    const current = answers[questionId] || { answers: {} };
    const updated = { answers: { ...current.answers, [statementId]: value } };
    handleAnswer(questionId, updated);
  };

  const handleSubmit = async (auto = false) => {
    if (!auto && !window.confirm('Bạn có chắc muốn nộp bài? Không thể thay đổi sau khi nộp.')) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await submissionService.submit(submissionId);
      onSubmitDone(res.result, submissionId);
    } catch (e) {
      setSubmitError(e.message);
      setSubmitting(false);
    }
  };

  const q = questions[current];
  const answeredCount = questions.filter(q => answers[q.id] !== undefined).length;

  const renderQuestion = () => {
    if (!q) return null;

    if (q.type === 'multiple_choice') {
      const sel = answers[q.id]?.selected || [];
      return (
        <div className="space-y-3">
          {q.options?.map((opt, i) => {
            const optionId = typeof opt === 'object' ? opt.id : String.fromCharCode(65 + i);
            const isSelected = sel.includes(optionId);
            const optionText = typeof opt === 'object' ? opt.text : opt;
            return (
              <button
                key={optionId}
                onClick={() => handleAnswer(q.id, { selected: [optionId] })}
                className={`w-full rounded-xl border-2 px-5 py-4 text-left text-sm transition ${
                  isSelected ? 'border-brand-500 bg-brand-50 text-brand-900 font-medium' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                <span className={`mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isSelected ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {optionId}
                </span>
                <MathViewer htmlContent={optionText} className="inline-block" />
              </button>
            );
          })}
        </div>
      );
    }

    if (q.type === 'true_false') {
      const tfAnswers = answers[q.id]?.answers || {};
      const statements = Array.isArray(q.options) ? q.options : q.options?.statements || [];
      return (
        <div className="space-y-3">
          {statements.map((stmt, i) => {
            const id = String(stmt?.id ?? (i + 1));
            const val = tfAnswers[id];
            return (
              <div key={id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm text-slate-800">
                  <span className="font-bold mr-1">{id}.</span> 
                  <MathViewer htmlContent={stmt.statement || stmt} className="inline-block" />
                </div>
                <div className="flex gap-3">
                  {[true, false].map(v => (
                    <button
                      key={String(v)}
                      onClick={() => handleTrueFalseAnswer(q.id, id, v)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                        val === v ? (v ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {v ? '✓ Đúng' : '✗ Sai'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (q.type === 'essay') {
      return (
        <textarea
          value={answers[q.id]?.text || ''}
          onChange={e => handleAnswer(q.id, { text: e.target.value })}
          placeholder="Viết câu trả lời của bạn tại đây..."
          className="w-full rounded-xl border border-slate-200 p-4 text-sm leading-relaxed focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          rows={8}
        />
      );
    }

    if (q.type === 'short_answer') {
      return (
        <div>
          <input
            type="text"
            value={answers[q.id]?.text || ''}
            onChange={e => handleAnswer(q.id, { text: e.target.value })}
            placeholder="Nhập kết quả ngắn gọn..."
            className="w-full rounded-xl border-2 border-slate-200 p-4 text-lg font-medium focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <p className="mt-2 text-xs text-slate-500">Lưu ý: Chỉ ghi kết quả cuối cùng (số, công thức hoặc cụm từ ngắn). Không ghi lời giải.</p>
        </div>
      );
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      {/* Khu vực câu hỏi */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-500">
              {q?.type === 'multiple_choice' ? 'Trắc nghiệm' : q?.type === 'true_false' ? 'Đúng / Sai' : q?.type === 'short_answer' ? 'Trả lời ngắn' : 'Tự luận'}
            </span>
            <span className="text-xs text-slate-400">
              {saving ? '💾 Đang lưu...' : '✓ Đã lưu'}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-500">Câu {current + 1} / {questions.length} · {q?.score} điểm</p>
          <div className="mt-3 text-base leading-relaxed text-slate-900">
            <MathViewer htmlContent={q?.content || ''} />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {renderQuestion()}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-30"
          >
            ← Câu trước
          </button>
          {current < questions.length - 1 ? (
            <button
              onClick={() => setCurrent(c => c + 1)}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Câu tiếp →
            </button>
          ) : (
            <button
              onClick={() => handleSubmit()}
              disabled={submitting}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Đang nộp...' : '✓ Nộp bài'}
            </button>
          )}
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      </div>

      {/* Sidebar: đồng hồ + lưới câu hỏi */}
      <div className="space-y-4">
        <div className={`rounded-2xl p-5 text-center ${urgent ? 'bg-red-50' : 'bg-brand-50'}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Thời gian còn lại</p>
          <p className={`mt-2 text-4xl font-bold tabular-nums ${urgent ? 'text-red-600 animate-pulse' : 'text-brand-700'}`}>
            {display}
          </p>
          <p className="mt-1 text-xs text-slate-400">{examInfo?.exam?.title}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ĐÃ TRẢ LỜI</span>
            <span className="text-sm font-bold text-brand-700">{answeredCount}/{questions.length}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((q, i) => {
              const answered = answers[q.id] !== undefined;
              const active = i === current;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrent(i)}
                  className={`aspect-square rounded-lg text-xs font-bold transition ${
                    active ? 'bg-brand-600 text-white ring-2 ring-brand-400'
                    : answered ? 'bg-brand-100 text-brand-700'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => handleSubmit()}
          disabled={submitting}
          className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? 'Đang nộp bài...' : '✓ Nộp bài ngay'}
        </button>
      </div>
    </div>
  );
};

// ── Component chính ───────────────────────────────────────────────
const ExamRoom = () => {
  const [phase, setPhase] = useState('enter'); // enter | exam | result
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [examData, setExamData] = useState(null);   // { submissionId, examInfo, questions, savedAnswers }
  const [resultData, setResultData] = useState(null); // { result, answers }

  const handleEnter = async (scheduleId) => {
    if (!scheduleId) return;
    setLoading(true);
    setError('');
    try {
      const res = await submissionService.enter(scheduleId);
      if (res.submission_status && res.submission_status !== 'in_progress') {
        setResultData({ result: res.result || null, answers: res.answers || [], review: res.review || null });
        setPhase('result');
      } else {
        setExamData({
          submissionId: res.submission_id,
          examInfo: res.exam,
          questions: res.questions || [],
          savedAnswers: res.savedAnswers || [],
        });
        setPhase('exam');
      }
    } catch (e) {
      setError(e.message || 'Không thể vào phòng thi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDone = async (result, submissionId) => {
    try {
      // Lấy kết quả chi tiết
      const detail = await submissionService.getResult(submissionId);
      setResultData({ result: detail.result || result, answers: detail.answers || [], review: detail.review || null });
    } catch {
      setResultData({ result, answers: [], review: null });
    }
    setPhase('result');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Phòng thi</h2>
        <p className="text-sm text-slate-500">
          {phase === 'enter' ? 'Chọn bài thi để bắt đầu'
           : phase === 'exam' ? examData?.examInfo?.title || 'Đang làm bài...'
           : 'Kết quả bài thi'}
        </p>
      </div>

      {phase === 'enter' && (
        <ScheduleListScreen onEnter={handleEnter} loading={loading} error={error} />
      )}

      {phase === 'exam' && examData && (
        <ExamScreen
          submissionId={examData.submissionId}
          examInfo={examData.examInfo}
          questions={examData.questions}
          savedAnswers={examData.savedAnswers}
          onSubmitDone={handleSubmitDone}
        />
      )}

      {phase === 'result' && resultData && (
        <ResultScreen
          result={resultData.result}
          answers={resultData.answers}
          review={resultData.review}
          onBack={() => { setPhase('enter'); setExamData(null); setResultData(null); }}
        />
      )}
    </div>
  );
};

export default ExamRoom;
