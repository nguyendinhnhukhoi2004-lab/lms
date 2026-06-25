import { useState, useEffect, useCallback } from 'react';
import { examService, questionService, subjectService, classService, teacherSubjectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import MathViewer from '../components/MathViewer';

// ── Hằng số ───────────────────────────────────────────────────────
const STATUS_LABELS  = { draft: 'Bản nháp', pending_approval: 'Chờ duyệt', approved: 'Đã duyệt', archived: 'Lưu trữ' };
const STATUS_COLORS  = { draft: 'bg-slate-100 text-slate-600', pending_approval: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', archived: 'bg-slate-200 text-slate-500' };
const TYPE_LABELS    = { multiple_choice: 'Trắc nghiệm', true_false: 'Đúng/Sai', short_answer: 'Trả lời ngắn', essay: 'Tự luận' };
const TYPE_COLORS    = { multiple_choice: 'bg-blue-100 text-blue-700', true_false: 'bg-violet-100 text-violet-700', short_answer: 'bg-teal-100 text-teal-700', essay: 'bg-orange-100 text-orange-700' };
// Mức độ nhận thức — CV 7991/BGDĐT-GDTrH ngày 17/12/2024 (3 mức)
const DIFF_LABELS    = { nhan_biet: 'Biết', thong_hieu: 'Hiểu', van_dung: 'Vận dụng' };
const DIFF_COLORS    = { nhan_biet: 'text-emerald-600', thong_hieu: 'text-blue-600', van_dung: 'text-amber-600' };
const DIFFICULTIES   = ['nhan_biet', 'thong_hieu', 'van_dung'];
const TYPES          = ['multiple_choice', 'true_false', 'short_answer', 'essay'];

// ── Helpers ───────────────────────────────────────────────────────
const fmt = (n) => parseFloat(n || 0).toFixed(2);
const scoreColor = (total) =>
  Math.abs(total - 10) < 0.01 ? 'text-emerald-600' : total > 10 ? 'text-red-600' : 'text-amber-600';

// ════════════════════════════════════════════════════════════════
// MODAL: Tạo / Sửa thông tin đề thi
// ════════════════════════════════════════════════════════════════
const ExamFormModal = ({ subjects, onSave, onClose }) => {
  const [form, setForm] = useState({ title: '', subject_id: subjects[0]?.id || '', duration_minutes: 45, description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Vui lòng nhập tên đề thi');
    setSaving(true); setError('');
    try { await examService.create(form); onSave(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Tạo đề thi mới</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700">Tên đề thi <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
              placeholder="VD: Kiểm tra 45 phút Toán 12 - HK1"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Môn học</label>
              <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name} (Khối {s.grade})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Thời gian (phút)</label>
              <input type="number" min={5} max={180} value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Mô tả</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              placeholder="Mô tả ngắn về nội dung đề thi..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Đang tạo...' : 'Tạo đề →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MODAL: Từ chối đề — bắt buộc nhập lý do
// ════════════════════════════════════════════════════════════════
const RejectModal = ({ exam, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return setError('Vui lòng ghi rõ lý do để giáo viên biết cần sửa gì');
    setSaving(true); setError('');
    try { await onConfirm(exam.id, reason.trim()); onClose(); }
    catch (err) { setError(err.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Từ chối đề thi</h3>
            <p className="text-xs text-slate-500 mt-0.5">{exam.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Lý do từ chối <span className="text-red-500">*</span>
            </label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} autoFocus
              placeholder="VD: Câu 3 sai đáp án. Câu 7 chưa phù hợp mức vận dụng cao. Tổng điểm nhóm tự luận cần điều chỉnh..."
              maxLength={500}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none resize-none" />
            <p className="mt-1 text-right text-xs text-slate-400">{reason.length}/500</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            💡 Lý do này sẽ hiển thị cho giáo viên để họ biết cần chỉnh sửa gì trước khi nộp lại.
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
            <button type="submit" disabled={saving || !reason.trim()}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Đang gửi...' : 'Xác nhận từ chối'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MODAL: Soạn đề THỦ CÔNG — chọn câu từ ngân hàng
// ════════════════════════════════════════════════════════════════
const ExamBuilderModal = ({ exam, onSave, onClose }) => {
  const [selected, setSelected]         = useState([]);
  const [bank, setBank]                 = useState([]);
  const [bankLoading, setBankLoading]   = useState(false);
  const [filters, setFilters]           = useState({ difficulty: '', type: '' });
  const [search, setSearch]             = useState('');
  const [editingScore, setEditingScore] = useState(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [tab, setTab]                   = useState('bank');

  const totalScore  = selected.reduce((s, i) => s + parseFloat(i.score || 0), 0);
  const selectedIds = new Set(selected.map(i => i.question.id));
  const isReadonly  = exam.status !== 'draft';

  useEffect(() => {
    if (exam?.questions?.length) {
      setSelected(exam.questions.map(q => ({ question: q, score: q.score || 1 })));
    }
    loadBank();
  }, []);

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    try {
      const data = await questionService.getAll({
        subject_id: exam.subject_id, is_approved: 'true', limit: 200,
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.type       && { type: filters.type }),
      });
      setBank(data.questions || []);
    } catch {} finally { setBankLoading(false); }
  }, [exam.subject_id, filters]);

  useEffect(() => { loadBank(); }, [filters]);

  const filteredBank = bank.filter(q =>
    !selectedIds.has(q.id) &&
    (!search || q.content.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAdd    = (q) => setSelected(p => [...p, { question: q, score: parseFloat(q.score) || 1 }]);
  const handleRemove = (qid) => setSelected(p => p.filter(i => i.question.id !== qid));
  const handleScoreChange = (qid, val) =>
    setSelected(p => p.map(i => i.question.id === qid ? { ...i, score: parseFloat(val) || 0 } : i));

  const moveUp   = (idx) => setSelected(p => { if (idx === 0) return p; const a = [...p]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a; });
  const moveDown = (idx) => setSelected(p => { if (idx === p.length-1) return p; const a = [...p]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a; });

  const handleSave = async () => {
    if (selected.length === 0) return setError('Đề thi phải có ít nhất 1 câu hỏi');
    const bad = selected.find(i => !i.score || i.score <= 0);
    if (bad) return setError(`"${bad.question.content.slice(0, 30)}..." phải có điểm > 0`);
    setSaving(true); setError('');
    try {
      await examService.setQuestions(exam.id, selected.map((item, idx) => ({
        question_id: item.question.id, score: parseFloat(item.score), order_index: idx + 1,
      })));
      onSave();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const statsByType = selected.reduce((acc, i) => { acc[i.question.type] = (acc[i.question.type]||0)+1; return acc; }, {});

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">✏️ Thủ công</span>
            <h3 className="text-base font-bold text-slate-900">{exam.title}</h3>
          </div>
          <p className="text-xs text-slate-500">{exam.subject_name} · {exam.duration_minutes} phút</p>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="max-w-xs text-xs text-red-600">{error}</span>}
          <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            {isReadonly ? 'Đóng' : 'Hủy'}
          </button>
          {!isReadonly && (
            <button onClick={handleSave} disabled={saving || selected.length === 0}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
              {saving ? 'Đang lưu...' : `Lưu đề (${selected.length} câu)`}
            </button>
          )}
        </div>
      </div>

      {/* Tab mobile */}
      <div className="flex border-b bg-white lg:hidden">
        {['bank','selected'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition ${tab === t ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500'}`}>
            {t === 'bank' ? `Ngân hàng (${filteredBank.length})` : `Đề thi (${selected.length} câu · ${fmt(totalScore)}đ)`}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Cột trái: Ngân hàng */}
        <div className={`flex flex-col border-r bg-white lg:w-[55%] ${tab === 'selected' ? 'hidden lg:flex' : 'flex w-full'}`}>
          <div className="space-y-2 border-b p-4">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Tìm nội dung câu hỏi..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            <div className="flex gap-2">
              <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none">
                <option value="">Tất cả loại</option>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <select value={filters.difficulty} onChange={e => setFilters(f => ({ ...f, difficulty: e.target.value }))}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-brand-400 focus:outline-none">
                <option value="">Tất cả độ khó</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFF_LABELS[d]}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-400">{filteredBank.length} câu phù hợp (đã ẩn câu đã chọn)</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {bankLoading ? (
              <div className="py-12 text-center text-sm text-slate-400">Đang tải ngân hàng...</div>
            ) : filteredBank.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Không có câu hỏi phù hợp</div>
            ) : filteredBank.map(q => (
              <div key={q.id} className="group flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 hover:border-brand-200 hover:bg-brand-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[q.type]}`}>{TYPE_LABELS[q.type]}</span>
                    <span className={`text-[10px] font-semibold ${DIFF_COLORS[q.difficulty]}`}>{DIFF_LABELS[q.difficulty]}</span>
                  </div>
                  <MathViewer htmlContent={q.content} className="line-clamp-2 text-sm text-slate-800" />
                </div>
                {!isReadonly && (
                  <button onClick={() => handleAdd(q)}
                    className="shrink-0 self-center rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 group-hover:opacity-100 transition hover:bg-brand-700">
                    + Thêm
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cột phải: Đề đang soạn */}
        <div className={`flex flex-col lg:flex-1 ${tab === 'bank' ? 'hidden lg:flex' : 'flex w-full'}`}>
          {/* Summary bar */}
          <div className="border-b bg-white px-5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500">Tổng: <strong className="text-slate-900">{selected.length} câu</strong></span>
                <span className={`text-sm font-bold ${scoreColor(totalScore)}`}>{fmt(totalScore)} / 10 điểm</span>
              </div>
              <div className="flex gap-2">
                {Object.entries(statsByType).map(([type, count]) => (
                  <span key={type} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[type]}`}>
                    {TYPE_LABELS[type]}: {count}
                  </span>
                ))}
              </div>
            </div>
            {totalScore > 0 && Math.abs(totalScore - 10) > 0.01 && (
              <p className={`mt-1 text-xs ${totalScore > 10 ? 'text-red-500' : 'text-amber-600'}`}>
                {totalScore > 10 ? `⚠ Vượt quá 10 điểm (+${fmt(totalScore-10)}đ)` : `💡 Còn thiếu ${fmt(10-totalScore)}đ để đủ 10 điểm`}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {selected.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                <div className="mb-3 text-4xl">📋</div>
                <p className="text-sm font-medium">Đề thi chưa có câu hỏi</p>
                <p className="mt-1 text-xs">Chọn câu từ ngân hàng bên trái</p>
              </div>
            ) : selected.map((item, idx) => (
              <div key={item.question.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{idx+1}</span>
                  {!isReadonly && <>
                    <button onClick={() => moveUp(idx)} disabled={idx===0} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none">▲</button>
                    <button onClick={() => moveDown(idx)} disabled={idx===selected.length-1} className="text-slate-300 hover:text-slate-600 disabled:opacity-20 text-xs leading-none">▼</button>
                  </>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[item.question.type]}`}>{TYPE_LABELS[item.question.type]}</span>
                    <span className={`text-[10px] font-semibold ${DIFF_COLORS[item.question.difficulty]}`}>{DIFF_LABELS[item.question.difficulty]}</span>
                  </div>
                  <p className="text-sm text-slate-800 line-clamp-2">{item.question.content}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {!isReadonly && (
                    <button onClick={() => handleRemove(item.question.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  )}
                  <div className="flex items-center gap-1">
                    {!isReadonly && editingScore === item.question.id ? (
                      <input type="number" min={0.25} max={10} step={0.25}
                        value={item.score}
                        onChange={e => handleScoreChange(item.question.id, e.target.value)}
                        onBlur={() => setEditingScore(null)}
                        autoFocus
                        className="w-16 rounded border border-brand-300 px-1.5 py-0.5 text-center text-xs focus:outline-none" />
                    ) : (
                      <button onClick={() => !isReadonly && setEditingScore(item.question.id)}
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${!isReadonly ? 'bg-slate-100 text-slate-700 hover:bg-brand-100 hover:text-brand-700 transition cursor-pointer' : 'bg-slate-50 text-slate-500 cursor-default'}`}>
                        {fmt(item.score)}đ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MODAL: Tạo đề TỰ ĐỘNG — nhập ma trận, hệ thống rút câu
// ════════════════════════════════════════════════════════════════
const AutoGenerateModal = ({ exam, onSave, onClose }) => {
  // Mỗi row trong ma trận: { type, difficulty, question_count, score_per_question, topic_filter }
  // Mặc định: 3 mức theo CV 7991 (Biết / Hiểu / Vận dụng)
  const [rows, setRows] = useState([
    { type: 'multiple_choice', difficulty: 'nhan_biet',  question_count: 6, score_per_question: 0.25, topic_filter: '' },
    { type: 'multiple_choice', difficulty: 'thong_hieu', question_count: 4, score_per_question: 0.25, topic_filter: '' },
    { type: 'true_false',      difficulty: 'van_dung',   question_count: 2, score_per_question: 1.00, topic_filter: '' },
    { type: 'essay',           difficulty: 'van_dung',   question_count: 1, score_per_question: 2.00, topic_filter: '' },
  ]);
  const [step, setStep]         = useState('matrix');   // 'matrix' | 'generating' | 'done' | 'error'
  const [progress, setProgress] = useState('');
  const [error, setError]       = useState('');
  const [resultMsg, setResultMsg] = useState('');

  const totalScore     = rows.reduce((s, r) => s + r.question_count * r.score_per_question, 0);
  const totalQuestions = rows.reduce((s, r) => s + r.question_count, 0);
  const scoreOk        = Math.abs(totalScore - 10) < 0.01;

  const addRow = () => setRows(r => [...r, { type: 'multiple_choice', difficulty: 'nhan_biet', question_count: 1, score_per_question: 0.25, topic_filter: '' }]);
  const removeRow = (idx) => setRows(r => r.filter((_, i) => i !== idx));
  const updateRow = (idx, field, val) => setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: val } : row));

  // Kiểm tra trùng tổ hợp type × difficulty
  const duplicates = new Set();
  const seen = new Set();
  rows.forEach((r, i) => {
    const k = `${r.type}__${r.difficulty}`;
    if (seen.has(k)) duplicates.add(i);
    seen.add(k);
  });

  const canGenerate = scoreOk && duplicates.size === 0 && rows.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStep('generating');
    setProgress('Đang lưu ma trận đề thi...');
    setError('');
    try {
      await examService.setMatrix(exam.id, rows.map(r => ({
        type: r.type,
        difficulty: r.difficulty,
        question_count: parseInt(r.question_count),
        score_per_question: parseFloat(r.score_per_question),
        topic_filter: r.topic_filter || undefined,
      })));
      setProgress('Đang rút câu hỏi ngẫu nhiên từ ngân hàng...');
      const result = await examService.autoGenerateFromMatrix(exam.id);
      setResultMsg(result.message || `Đã tạo ${totalQuestions} câu hỏi theo ma trận`);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };

  // Gợi ý phân bổ nhanh cho các dạng đề phổ biến — theo CV 7991 (3 mức)
  const presets = [
    {
      label: '15 phút · 15 MCQ',
      rows: [
        { type: 'multiple_choice', difficulty: 'nhan_biet',  question_count: 6, score_per_question: 0.25, topic_filter: '' },
        { type: 'multiple_choice', difficulty: 'thong_hieu', question_count: 5, score_per_question: 0.75, topic_filter: '' },
        { type: 'multiple_choice', difficulty: 'van_dung',   question_count: 4, score_per_question: 0.25, topic_filter: '' },
      ],
    },
    {
      label: '45 phút · MCQ + Tự luận',
      rows: [
        { type: 'multiple_choice', difficulty: 'nhan_biet',  question_count: 6, score_per_question: 0.25, topic_filter: '' },
        { type: 'multiple_choice', difficulty: 'thong_hieu', question_count: 4, score_per_question: 0.25, topic_filter: '' },
        { type: 'true_false',      difficulty: 'van_dung',   question_count: 2, score_per_question: 1.00, topic_filter: '' },
        { type: 'essay',           difficulty: 'van_dung',   question_count: 1, score_per_question: 2.00, topic_filter: '' },
      ],
    },
    {
      label: 'Học kỳ · 40 MCQ',
      rows: [
        { type: 'multiple_choice', difficulty: 'nhan_biet',  question_count: 10, score_per_question: 0.25,  topic_filter: '' },
        { type: 'multiple_choice', difficulty: 'thong_hieu', question_count: 15, score_per_question: 0.25,  topic_filter: '' },
        { type: 'multiple_choice', difficulty: 'van_dung',   question_count: 15, score_per_question: 0.125, topic_filter: '' },
      ],
    },
  ];

  if (step === 'generating') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-80 rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mb-4 flex justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          </div>
          <p className="font-semibold text-slate-800">Đang tạo đề thi...</p>
          <p className="mt-2 text-sm text-slate-500">{progress}</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mb-4 flex justify-center text-5xl">✅</div>
          <p className="text-lg font-bold text-slate-900">Tạo đề thành công!</p>
          <p className="mt-2 text-sm text-slate-500">{resultMsg}</p>
          <div className="mt-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            Tổng: {totalQuestions} câu · 10 điểm
          </div>
          <button onClick={onSave} className="mt-5 w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700">
            Về quản lý đề →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-3 text-center text-4xl">⚠️</div>
          <p className="text-center text-lg font-bold text-slate-900">Không thể tạo đề</p>
          <div className="mt-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
          <p className="mt-3 text-center text-xs text-slate-500">Kiểm tra lại ngân hàng câu hỏi hoặc điều chỉnh ma trận.</p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setStep('matrix')} className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              ← Sửa ma trận
            </button>
            <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === 'matrix'
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">⚡ Tự động</span>
            <h3 className="text-base font-bold text-slate-900">{exam.title}</h3>
          </div>
          <p className="text-xs text-slate-500">{exam.subject_name} · {exam.duration_minutes} phút</p>
        </div>
        <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">

        {/* Cột trái: Ma trận */}
        <div className="flex flex-col lg:flex-1 lg:overflow-y-auto">
          <div className="border-b bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">Ma trận đề thi</h4>
                <p className="text-xs text-slate-500 mt-0.5">Theo chuẩn Thông tư 22 — mỗi tổ hợp Loại × Mức độ chỉ 1 lần</p>
              </div>
              <button onClick={addRow}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                + Thêm nhóm
              </button>
            </div>

            {/* Gợi ý nhanh */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Mẫu nhanh:</p>
              <div className="flex flex-wrap gap-2">
                {presets.map(p => (
                  <button key={p.label} onClick={() => setRows(p.rows)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bảng ma trận */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Loại câu</th>
                    <th className="px-3 py-2.5 text-left">Mức độ</th>
                    <th className="px-3 py-2.5 text-center">Số câu</th>
                    <th className="px-3 py-2.5 text-center">Đ/câu</th>
                    <th className="px-3 py-2.5 text-center">Subtotal</th>
                    <th className="px-3 py-2.5 text-left">Chủ đề (tùy chọn)</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row, idx) => {
                    const isDup = duplicates.has(idx);
                    return (
                      <tr key={idx} className={isDup ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2">
                          <select value={row.type} onChange={e => updateRow(idx, 'type', e.target.value)}
                            className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none">
                            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={row.difficulty} onChange={e => updateRow(idx, 'difficulty', e.target.value)}
                            className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none">
                            {DIFFICULTIES.map(d => <option key={d} value={d}>{DIFF_LABELS[d]}</option>)}
                          </select>
                          {isDup && <p className="text-[10px] text-red-500 mt-0.5">Bị trùng!</p>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={1} max={50} value={row.question_count}
                            onChange={e => updateRow(idx, 'question_count', parseInt(e.target.value)||1)}
                            className="w-14 rounded border border-slate-200 px-2 py-1 text-center text-xs focus:border-brand-400 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0.125} max={10} step={0.125} value={row.score_per_question}
                            onChange={e => updateRow(idx, 'score_per_question', parseFloat(e.target.value)||0.25)}
                            className="w-16 rounded border border-slate-200 px-2 py-1 text-center text-xs focus:border-brand-400 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="font-semibold text-slate-700 text-xs">
                            {fmt(row.question_count * row.score_per_question)}đ
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <input value={row.topic_filter} onChange={e => updateRow(idx, 'topic_filter', e.target.value)}
                            placeholder="VD: Hàm số, Điện học..."
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none" />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={() => removeRow(idx)}
                            className="text-slate-300 hover:text-red-500 text-sm transition">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cột phải: Tóm tắt + Nút tạo */}
        <div className="border-l bg-white p-6 lg:w-64 lg:flex-shrink-0">
          <h4 className="mb-4 font-semibold text-slate-900">Tổng kết</h4>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tổng số câu</span>
              <span className="font-bold text-slate-900">{totalQuestions} câu</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tổng điểm</span>
              <span className={`font-bold ${scoreOk ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmt(totalScore)} / 10đ
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Nhóm câu</span>
              <span className="font-bold text-slate-900">{rows.length} nhóm</span>
            </div>
          </div>

          {/* Thanh điểm */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>0đ</span><span>10đ</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${scoreOk ? 'bg-emerald-500' : totalScore > 10 ? 'bg-red-500' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(totalScore / 10 * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Validation messages */}
          <div className="mt-4 space-y-2">
            {!scoreOk && (
              <div className={`rounded-lg p-3 text-xs ${totalScore > 10 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                {totalScore > 10
                  ? `⚠ Vượt quá 10đ (+${fmt(totalScore-10)}đ). Giảm số câu hoặc điểm/câu.`
                  : `💡 Còn thiếu ${fmt(10-totalScore)}đ. Thêm câu hoặc tăng điểm/câu.`}
              </div>
            )}
            {duplicates.size > 0 && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                ⚠ Có {duplicates.size} tổ hợp Loại × Mức độ bị trùng nhau.
              </div>
            )}
            {scoreOk && duplicates.size === 0 && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                ✓ Ma trận hợp lệ — sẵn sàng tạo đề!
              </div>
            )}
          </div>

          <button onClick={handleGenerate} disabled={!canGenerate}
            className="mt-5 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 transition">
            ⚡ Tạo đề tự động
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Hệ thống sẽ lưu ma trận, sau đó rút ngẫu nhiên câu hỏi đã duyệt từ ngân hàng.
          </p>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MODAL: Lên lịch thi
// ════════════════════════════════════════════════════════════════
const ScheduleModal = ({ exam, classes, onClose }) => {
  const [form, setForm]           = useState({ class_id: classes[0]?.id || '', start_time: '', end_time: '', review_mode: 'after_close' });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [schedules, setSchedules] = useState([]);
  const [rescheduleSchedule, setRescheduleSchedule] = useState(null);

  const toDatetimeLocal = (iso) => {
    if (!iso) return '';
    const dt = new Date(iso);
    const pad = (value) => String(value).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const toIsoFromDatetimeLocal = (datetimeLocal) => {
    if (!datetimeLocal) return '';
    // Keep the local datetime string without converting to UTC (avoid shifting timezone)
    // datetimeLocal format: "YYYY-MM-DDTHH:MM" -> return "YYYY-MM-DDTHH:MM:SS"
    return `${datetimeLocal}:00`;
  };

  useEffect(() => {
    examService.getSchedules({ exam_id: exam.id }).then(s => setSchedules(s || [])).catch(() => {});
  }, [exam.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');

    if (!form.start_time || !form.end_time) {
      setError('Vui lòng chọn giờ bắt đầu và giờ kết thúc');
      setSaving(false);
      return;
    }

    const startDate = new Date(form.start_time);
    const endDate = new Date(form.end_time);
    if (endDate <= startDate) {
      setError('Giờ kết thúc phải sau giờ bắt đầu');
      setSaving(false);
      return;
    }

    try {
      if (rescheduleSchedule) {
        await examService.updateSchedule(rescheduleSchedule.id, {
          start_time: toIsoFromDatetimeLocal(form.start_time),
          end_time: toIsoFromDatetimeLocal(form.end_time),
        });
      } else {
        await examService.createSchedule({
          exam_id: exam.id,
          class_id: form.class_id,
          start_time: toIsoFromDatetimeLocal(form.start_time),
          end_time: toIsoFromDatetimeLocal(form.end_time),
        });
      }

      const s = await examService.getSchedules({ exam_id: exam.id });
      setSchedules(s || []);
      setForm({ class_id: classes[0]?.id || '', start_time: '', end_time: '', review_mode: 'after_close' });
      setRescheduleSchedule(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Hủy lịch thi này?')) return;
    try { await examService.cancelSchedule(id); const s = await examService.getSchedules({ exam_id: exam.id }); setSchedules(s||[]); }
    catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa hoàn toàn lịch thi này? Hành động không thể hoàn tác.')) return;
    try {
      await examService.deleteSchedule(id);
      const s = await examService.getSchedules({ exam_id: exam.id });
      setSchedules(s||[]);
    } catch (e) { alert(e.message); }
  };

  const handleReschedule = (s) => {
    setError('');
    setRescheduleSchedule(s);
    setForm({
      class_id: s.class_id,
      start_time: toDatetimeLocal(s.start_time),
      end_time: toDatetimeLocal(s.end_time),
    });
  };

  const clearReschedule = () => {
    setRescheduleSchedule(null);
    setForm({ class_id: classes[0]?.id || '', start_time: '', end_time: '', review_mode: 'after_close' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Lên lịch thi</h3>
            <p className="text-sm text-slate-500">{exam.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="space-y-5 p-6">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Thêm lịch mới</p>
            {rescheduleSchedule && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                Dời lịch từ <strong>{rescheduleSchedule.class_name}</strong>
                <div className="mt-1 text-xs text-slate-500">
                  {new Date(rescheduleSchedule.start_time).toLocaleString('vi-VN')} → {new Date(rescheduleSchedule.end_time).toLocaleString('vi-VN')}
                </div>
                <button type="button" onClick={clearReschedule}
                  className="mt-2 inline-flex rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
                  Hủy dời
                </button>
              </div>
            )}
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div>
              <label className="block text-xs font-medium text-slate-600">Lớp</label>
              <select value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.school_year})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600">Giờ bắt đầu</label>
                <input type="datetime-local" value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">Giờ kết thúc</label>
                <input type="datetime-local" value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cho phép xem lại đề sau khi thi</label>
              <select value={form.review_mode} onChange={e => setForm(f => ({ ...f, review_mode: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none">
                <option value="after_submit">✅ Xem ngay sau khi nộp bài</option>
                <option value="after_close">🔒 Chỉ xem sau khi đề đóng</option>
                <option value="never">🚫 Không cho xem lại</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : rescheduleSchedule ? 'Tạo lịch mới' : '+ Thêm lịch thi'}
            </button>
          </form>
          {schedules.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">Lịch đã lên ({schedules.length})</p>
              <div className="space-y-2">
                {schedules.map(s => (
                  <div key={s.id} className={`flex items-center justify-between rounded-lg px-4 py-3 ${s.is_active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.class_name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(s.start_time).toLocaleString('vi-VN')} → {new Date(s.end_time).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {s.is_active && <button onClick={() => handleCancel(s.id)} className="text-xs text-red-500 hover:underline">Hủy</button>}
                      <button onClick={() => handleReschedule(s)} className="text-xs text-blue-600 hover:underline">Dời</button>
                      <button onClick={() => handleDelete(s.id)} className="text-xs text-slate-500 hover:underline">Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// TRANG CHÍNH
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// MODAL: Import file → Tạo đề thi (3 bước)
// Bước 1: Upload file + xem trước câu hỏi parse được
// Bước 2: Gán điểm từng câu (tổng phải = 10)
// Bước 3: Điền thông tin đề thi → Tạo đề
// ════════════════════════════════════════════════════════════════
const TYPE_LABELS_SHORT = { multiple_choice: 'MCQ', true_false: 'Đ/S', short_answer: 'TLN', essay: 'TL' };
const TYPE_COLORS_SM    = { multiple_choice: 'bg-blue-100 text-blue-700', true_false: 'bg-violet-100 text-violet-700', short_answer: 'bg-teal-100 text-teal-700', essay: 'bg-orange-100 text-orange-700' };
const DIFF_LABELS_SM    = { nhan_biet: 'Biết', thong_hieu: 'Hiểu', van_dung: 'VD' };
const DIFF_COLORS_SM    = { nhan_biet: 'text-emerald-600', thong_hieu: 'text-blue-600', van_dung: 'text-amber-600' };

const fmtScore = (n) => parseFloat(n || 0).toFixed(2);

const ImportExamModal = ({ subjects, onSave, onClose }) => {
  const [step, setStep]           = useState(1); // 1=upload, 2=điểm, 3=thông tin
  const [file, setFile]           = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [parseResult, setParseResult] = useState(null); // { questions, errors }
  // questions: [{ type, difficulty, content, score }]
  const [questions, setQuestions] = useState([]);
  const [examForm, setExamForm]   = useState({
    title: '', subject_id: subjects[0]?.id || '',
    duration_minutes: 45, description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [doneExam, setDoneExam]     = useState(null);

  const totalScore    = questions.reduce((s, q) => s + parseFloat(q.score || 0), 0);
  const scoreOk       = Math.abs(totalScore - 10) < 0.01;
  const scoreColor    = scoreOk ? 'text-emerald-600' : totalScore > 10 ? 'text-red-600' : 'text-amber-600';

  // ── Bước 1: Chọn file & parse ──────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|docx|doc)$/i)) {
      setError('Chỉ chấp nhận file .xlsx hoặc .docx'); return;
    }
    setFile(f); setError(''); setParseResult(null); setQuestions([]);
  };

  const handleParse = async () => {
    if (!file) return;
    setParsing(true); setError('');
    try {
      // Gửi file lên server để parse (dùng endpoint parse-only)
      const formData = new FormData();
      formData.append('file', file);
      const data = await examService.parseFile(formData);

      if (data.questions.length === 0) {
        setError('Không tìm thấy câu hỏi hợp lệ nào. Kiểm tra lại định dạng file.');
        setParsing(false); return;
      }

      // Gán điểm mặc định: chia đều 10 điểm
      const defaultScore = parseFloat((10 / data.questions.length).toFixed(4));
      const qs = data.questions.map(q => ({ ...q, score: defaultScore }));
      setQuestions(qs);
      setParseResult({ total: data.questions.length, errors: data.errors || [] });
      setStep(2);
    } catch (err) { setError(err.message); }
    finally { setParsing(false); }
  };

  // ── Bước 2: Gán điểm ───────────────────────────────────────
  const updateScore = (idx, val) =>
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, score: parseFloat(val) || 0 } : q));

  const distributeEvenly = () => {
    const s = parseFloat((10 / questions.length).toFixed(4));
    setQuestions(qs => qs.map(q => ({ ...q, score: s })));
  };

  // ── Bước 3: Tạo đề ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!examForm.title.trim()) return setError('Vui lòng nhập tên đề thi');
    if (!examForm.subject_id)   return setError('Vui lòng chọn môn học');
    if (!scoreOk) return setError(`Tổng điểm phải đúng 10 (hiện tại: ${fmtScore(totalScore)})`);

    setSubmitting(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title',            examForm.title.trim());
      formData.append('subject_id',       examForm.subject_id);
      formData.append('duration_minutes', examForm.duration_minutes);
      formData.append('description',      examForm.description || '');
      formData.append('questions_meta',   JSON.stringify(
        questions.map((q, i) => ({ index: i, score: q.score }))
      ));

      const data = await examService.importFile(formData);
      setDoneExam(data.exam);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  // ── Màn hình thành công ────────────────────────────────────
  if (doneExam) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
          <div className="mb-4 text-5xl">✅</div>
          <p className="text-lg font-bold text-slate-900">Tạo đề thi thành công!</p>
          <p className="mt-1 text-sm text-slate-500">{doneExam.title}</p>
          <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            {doneExam.question_count} câu hỏi · Bản nháp
          </div>
          <p className="mt-3 text-xs text-slate-400">Đề đang ở trạng thái bản nháp. Vào "Quản lý đề thi" để xem và gửi duyệt.</p>
          <button onClick={() => { onSave(); }}
            className="mt-5 w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700">
            Xem đề thi →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header + stepper */}
      <div className="border-b bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Import file → Tạo đề thi</h3>
            <p className="text-xs text-slate-500">Upload file Excel/Word có sẵn câu hỏi</p>
          </div>
          <button onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-2">
          {[
            { n: 1, label: 'Upload file' },
            { n: 2, label: 'Gán điểm' },
            { n: 3, label: 'Thông tin đề' },
          ].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition
                ${step === n ? 'bg-brand-600 text-white' : step > n ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {step > n ? '✓' : n}
              </div>
              <span className={`text-xs font-medium ${step === n ? 'text-brand-700' : step > n ? 'text-emerald-600' : 'text-slate-400'}`}>
                {label}
              </span>
              {i < 2 && <div className={`h-px w-8 ${step > n ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── BƯỚC 1: Upload ─────────────────────────────────── */}
        {step === 1 && (
          <div className="mx-auto max-w-xl space-y-4">
            {/* Tải template */}
            <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-blue-800">Chưa có file mẫu?</p>
                <p className="text-xs text-blue-600">Tải template Excel với hướng dẫn và câu hỏi mẫu</p>
              </div>
              <a href="/template_import_cauhoi.xlsx" download
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                ↓ Tải template
              </a>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('importExamFile').click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-14 transition
                ${dragOver ? 'border-brand-400 bg-brand-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50'}`}
            >
              <input id="importExamFile" type="file" accept=".xlsx,.xls,.docx,.doc" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />
              <div className="mb-3 text-4xl">{file ? '📄' : '☁️'}</div>
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null); setError(''); }}
                    className="mt-2 text-xs text-red-500 hover:underline">Chọn file khác</button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">Kéo thả file vào đây</p>
                  <p className="text-xs text-slate-400 mt-1">hoặc click để chọn · .xlsx / .docx · tối đa 10MB</p>
                </div>
              )}
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <button onClick={handleParse} disabled={!file || parsing}
              className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
              {parsing ? '⏳ Đang đọc file...' : '→ Đọc câu hỏi từ file'}
            </button>
          </div>
        )}

        {/* ── BƯỚC 2: Gán điểm ───────────────────────────────── */}
        {step === 2 && (
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-slate-500">Số câu</p>
                  <p className="text-xl font-bold text-slate-900">{questions.length}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tổng điểm</p>
                  <p className={`text-xl font-bold ${scoreColor}`}>{fmtScore(totalScore)} / 10</p>
                </div>
                {parseResult?.errors?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500">Dòng bỏ qua</p>
                    <p className="text-xl font-bold text-amber-600">{parseResult.errors.length}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={distributeEvenly}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  Chia đều
                </button>
              </div>
            </div>

            {/* Thanh điểm */}
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${scoreOk ? 'bg-emerald-500' : totalScore > 10 ? 'bg-red-500' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(totalScore / 10 * 100, 100)}%` }} />
            </div>
            {!scoreOk && (
              <p className={`text-xs ${totalScore > 10 ? 'text-red-500' : 'text-amber-600'}`}>
                {totalScore > 10
                  ? `⚠ Vượt quá 10đ (+${fmtScore(totalScore - 10)}đ) — giảm điểm một số câu`
                  : `💡 Còn thiếu ${fmtScore(10 - totalScore)}đ — tăng điểm hoặc dùng "Chia đều"`}
              </p>
            )}

            {/* Danh sách câu hỏi */}
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex flex-wrap gap-1.5 items-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS_SM[q.type]}`}>
                        {TYPE_LABELS_SHORT[q.type]}
                      </span>
                      <span className={`text-[10px] font-semibold ${DIFF_COLORS_SM[q.difficulty]}`}>
                        {DIFF_LABELS_SM[q.difficulty]}
                      </span>
                    </div>
                    <MathViewer htmlContent={q.content} className="line-clamp-2 text-sm text-slate-800" />
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <input type="number" min={0.125} max={10} step={0.125}
                      value={q.score}
                      onChange={e => updateScore(idx, e.target.value)}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm font-semibold focus:border-brand-400 focus:outline-none" />
                    <span className="text-xs text-slate-400">đ</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cảnh báo dòng lỗi */}
            {parseResult?.errors?.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">
                  ⚠ {parseResult.errors.length} dòng bị bỏ qua do lỗi định dạng:
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {parseResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-amber-700">• Dòng/Câu {e.row}: {e.error}</p>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => { setStep(1); setError(''); }}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                ← Quay lại
              </button>
              <button onClick={() => { setError(''); setStep(3); }} disabled={!scoreOk}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
                Tiếp theo →
              </button>
            </div>
          </div>
        )}

        {/* ── BƯỚC 3: Thông tin đề thi ───────────────────────── */}
        {step === 3 && (
          <div className="mx-auto max-w-lg space-y-4">
            <div className="rounded-xl bg-white p-6 shadow-sm space-y-4">
              <h4 className="font-semibold text-slate-900">Thông tin đề thi</h4>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tên đề thi <span className="text-red-500">*</span>
                </label>
                <input value={examForm.title}
                  onChange={e => setExamForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="VD: Kiểm tra 45 phút Toán 12 — HK1"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Môn học</label>
                  <select value={examForm.subject_id}
                    onChange={e => setExamForm(f => ({ ...f, subject_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} (K{s.grade})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
                  <input type="number" min={5} max={180} value={examForm.duration_minutes}
                    onChange={e => setExamForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả (tùy chọn)</label>
                <textarea value={examForm.description} rows={3}
                  onChange={e => setExamForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả ngắn về nội dung đề thi..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none resize-none" />
              </div>
            </div>

            {/* Tóm tắt */}
            <div className="rounded-xl bg-slate-100 px-5 py-4 space-y-1.5 text-sm">
              <p className="font-semibold text-slate-700 mb-2">Tóm tắt đề thi sẽ tạo:</p>
              <div className="flex justify-between"><span className="text-slate-500">Số câu hỏi</span><span className="font-semibold">{questions.length} câu</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tổng điểm</span><span className="font-semibold text-emerald-600">10 điểm</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Thời gian</span><span className="font-semibold">{examForm.duration_minutes} phút</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Trạng thái</span><span className="font-semibold text-slate-600">Bản nháp</span></div>
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="flex gap-3">
              <button onClick={() => { setStep(2); setError(''); }}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                ← Quay lại
              </button>
              <button onClick={handleCreate} disabled={submitting}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
                {submitting ? '⏳ Đang tạo đề...' : '✓ Tạo đề thi'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MODAL: Xếp phòng thi động
// ════════════════════════════════════════════════════════════════
const GenerateRoomsModal = ({ exam, onClose, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (!window.confirm('Trộn phòng thi cho bài kiểm tra này?')) return;
    setLoading(true);
    setError('');
    try {
      const res = await examService.generateRooms(exam.id);
      setResult(res);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || 'Lỗi khi xếp phòng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Trộn phòng thi</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Hệ thống sẽ tự động xếp danh sách học sinh đăng ký môn học này vào các phòng thi. Mỗi phòng mặc định 24 học sinh.
          </p>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {result && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <span className="font-semibold block mb-1">✓ Xếp phòng thành công!</span>
              Tổng số học sinh: {result.total_students} <br/>
              Tổng số phòng: {result.total_rooms}
            </div>
          )}
          {!result && (
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
              <button onClick={handleGenerate} disabled={loading}
                className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                {loading ? 'Đang xếp phòng...' : 'Bắt đầu xếp phòng'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ExamManagement = () => {
  const { user }                        = useAuth();
  const [exams, setExams]               = useState([]);
  const [subjects, setSubjects]         = useState([]);
  const [classes, setClasses]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [showBuilder, setShowBuilder]   = useState(null);      // exam — soạn thủ công
  const [showAutoGen, setShowAutoGen]   = useState(null);      // exam — tạo tự động
  const [showSchedule, setShowSchedule] = useState(null);      // exam — lên lịch
  const [showReject, setShowReject]     = useState(null);      // exam — từ chối
  const [showImport, setShowImport]     = useState(false);     // import file → tạo đề
  const [showGenerateRooms, setShowGenerateRooms] = useState(null); // exam - xếp phòng thi
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError]               = useState('');

  const isHead = user?.role === 'department_head' || user?.role === 'admin';

  useEffect(() => {
    Promise.all([
      loadExams(),
      loadSubjects(),
      classService.getAll().then(setClasses).catch(() => {}),
    ]);
  }, [filterStatus]);

  const loadSubjects = async () => {
    try {
      // Giáo viên chỉ thấy môn được phân công; admin/tổ trưởng thấy tất cả
      if (user?.role === 'teacher') {
        const assigned = await teacherSubjectService.getMySubjects();
        // assigned trả về [{ subject_id, subject_name, grade }]
        // Map sang format subjects thông thường
        const subs = assigned.map(s => ({
          id: s.subject_id, name: s.subject_name, grade: s.grade,
        }));
        setSubjects(subs.length > 0 ? subs : await subjectService.getAll());
      } else {
        setSubjects(await subjectService.getAll());
      }
    } catch { setSubjects(await subjectService.getAll().catch(() => [])); }
  };

  const loadExams = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const data = await examService.getAll(params);
      setExams(data.exams || data || []);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleOpenBuilder = async (exam) => {
    try { const detail = await examService.getById(exam.id); setShowBuilder(detail); }
    catch { setShowBuilder(exam); }
  };

  const handleSubmitApproval = async (id) => {
    try { await examService.submitForApproval(id); loadExams(); }
    catch (e) { alert(e.message); }
  };

  const handleApprove = async (id) => {
    try { await examService.approve(id); loadExams(); }
    catch (e) { alert(e.message); }
  };

  const handleDeleteExam = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa đề thi này?')) return;
    try {
      await examService.delete(id);
      loadExams();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRejectConfirm = async (id, reason) => {
    await examService.reject(id, reason);
    loadExams();
  };

  const handleTriggerExam = async (id) => {
    if (!window.confirm('Kích hoạt bài kiểm tra thường xuyên này? Học sinh có thể làm bài ngay lập tức.')) return;
    try {
      await examService.triggerExam(id);
      loadExams();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExportExcel = async (id, title) => {
    try {
      const blob = await examService.exportExcel(id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `De_Thi_${title}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (e) {
      alert('Không thể xuất file: ' + e.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý đề thi</h2>
          <p className="text-sm text-slate-500">{exams.length} đề thi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="rounded-xl border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50">
            ↑ Import file
          </button>
          <button onClick={() => setShowForm(true)}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            + Tạo đề thi mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-4 shadow-sm">
        {['', 'draft', 'pending_approval', 'approved', 'archived'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${filterStatus === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s === '' ? 'Tất cả' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Danh sách đề thi */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">Đang tải...</div>
      ) : exams.length === 0 ? (
        <div className="rounded-xl bg-white py-16 text-center shadow-sm">
          <p className="text-slate-400">Chưa có đề thi nào</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-brand-600 hover:underline">Tạo đề thi đầu tiên →</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {exams.map(exam => (
            <div key={exam.id} className="flex flex-col rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2">{exam.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {exam.subject_name} · {exam.duration_minutes} phút
                    {exam.question_count > 0 && ` · ${exam.question_count} câu`}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[exam.status]}`}>
                  {STATUS_LABELS[exam.status]}
                </span>
              </div>

              {exam.description && (
                <p className="mb-3 text-xs text-slate-400 line-clamp-2">{exam.description}</p>
              )}

              <div className="mb-3 space-y-1 text-xs text-slate-500">
                <div>Giáo viên tạo: <span className="font-semibold text-slate-700">{exam.created_by_name}</span></div>
                {exam.status === 'approved' && exam.approved_by_name && (
                  <div>Đã duyệt bởi: <span className="font-semibold text-slate-700">{exam.approved_by_name}</span></div>
                )}
              </div>

              {/* Lý do từ chối (nếu có) */}
              {exam.rejection_reason && exam.status === 'draft' && (
                <div className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                  <span className="font-semibold">Bị từ chối: </span>{exam.rejection_reason}
                </div>
              )}

              {exam.total_score > 0 && (
                <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{exam.total_score} điểm</span>
                  <span>·</span>
                  <span>{exam.question_count} câu</span>
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {/* Draft: 2 nút soạn đề */}
                {exam.status === 'draft' && (
                  <>
                    <button onClick={() => handleOpenBuilder(exam)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                      ✏️ Thủ công
                    </button>
                    <button onClick={() => setShowAutoGen(exam)}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
                      ⚡ Tự động
                    </button>
                  </>
                )}

                {/* Xem đề khi không phải draft */}
                {exam.status !== 'draft' && exam.question_count > 0 && (
                  <button onClick={() => handleOpenBuilder(exam)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                    👁 Xem đề
                  </button>
                )}

                {/* Gửi duyệt */}
                {exam.status === 'draft' && exam.question_count > 0 && (
                  <button onClick={() => handleSubmitApproval(exam.id)}
                    className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                    Gửi duyệt
                  </button>
                )}

                {/* Tổ trưởng duyệt / từ chối */}
                {isHead && exam.status === 'pending_approval' && (
                  <>
                    <button onClick={() => handleApprove(exam.id)}
                      className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                      ✓ Duyệt
                    </button>
                    <button onClick={() => setShowReject(exam)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                      ✗ Từ chối
                    </button>
                  </>
                )}

                {/* Xóa đề thi (chỉ dùng cho bản nháp) */}
                {exam.status === 'draft' && (user.role === 'admin' || exam.created_by === user.id) && (
                  <button onClick={() => handleDeleteExam(exam.id)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
                    🗑 Xóa
                  </button>
                )}

                {/* Lên lịch */}
                {exam.status === 'approved' && (
                  <button onClick={() => setShowSchedule(exam)}
                    className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                    📅 Lên lịch
                  </button>
                )}

                {/* Xếp phòng thi (Giữa kỳ/Cuối kỳ) */}
                {exam.status === 'approved' && isHead && (
                  <button onClick={() => setShowGenerateRooms(exam)}
                    className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                    👥 Xếp phòng
                  </button>
                )}

                {/* Kích hoạt (Thường xuyên) */}
                {(exam.status === 'approved' || exam.status === 'draft') && exam.exam_type === 'thuong_xuyen' && (
                  <button onClick={() => handleTriggerExam(exam.id)}
                    className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100">
                    ⚡ Kích hoạt
                  </button>
                )}

                {/* Xuất Excel */}
                {exam.question_count > 0 && (
                  <button onClick={() => handleExportExcel(exam.id, exam.title)}
                    className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 ml-auto">
                    📥 Xuất Excel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <ExamFormModal subjects={subjects}
          onSave={() => { setShowForm(false); loadExams(); }}
          onClose={() => setShowForm(false)} />
      )}

      {showBuilder && (
        <ExamBuilderModal exam={showBuilder}
          onSave={() => { setShowBuilder(null); loadExams(); }}
          onClose={() => setShowBuilder(null)} />
      )}

      {showAutoGen && (
        <AutoGenerateModal exam={showAutoGen}
          onSave={() => { setShowAutoGen(null); loadExams(); }}
          onClose={() => setShowAutoGen(null)} />
      )}

      {showImport && (
        <ImportExamModal subjects={subjects}
          onSave={() => { setShowImport(false); loadExams(); }}
          onClose={() => setShowImport(false)} />
      )}

      {showReject && (
        <RejectModal exam={showReject}
          onConfirm={handleRejectConfirm}
          onClose={() => setShowReject(null)} />
      )}

      {showSchedule && (
        <ScheduleModal exam={showSchedule} classes={classes}
          onClose={() => setShowSchedule(null)} />
      )}

      {showGenerateRooms && (
        <GenerateRoomsModal exam={showGenerateRooms}
          onRefresh={() => loadExams()}
          onClose={() => setShowGenerateRooms(null)} />
      )}
    </div>
  );
};

export default ExamManagement;
