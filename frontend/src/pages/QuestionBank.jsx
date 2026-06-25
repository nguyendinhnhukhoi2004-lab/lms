import { useState, useEffect } from 'react';
import { questionService, subjectService, teacherSubjectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RichTextEditor from '../components/RichTextEditor';
import MathViewer from '../components/MathViewer';

// Mức độ nhận thức — CV 7991/BGDĐT-GDTrH ngày 17/12/2024
const LEVELS = [
  { value: 'nhan_biet',  label: 'Biết' },
  { value: 'thong_hieu', label: 'Hiểu' },
  { value: 'van_dung',   label: 'Vận dụng' },
];
const LEVEL_LABEL = Object.fromEntries(LEVELS.map(l => [l.value, l.label]));
const TYPES = { multiple_choice: 'Trắc nghiệm', true_false: 'Đúng/Sai', short_answer: 'Trả lời ngắn', essay: 'Tự luận' };

// ── Form nhập đáp án theo loại câu hỏi ───────────────────────────
const AnswerSection = ({ type, correct_answer, onChange }) => {
  if (type === 'multiple_choice') {
    const options = correct_answer?.options || ['', '', '', ''];
    // Backend format: {"selected":["A"]} — lấy đáp án đúng từ selected[0]
    const correct = (correct_answer?.selected?.[0]) || correct_answer?.correct || 'A';
    return (
      <div className="space-y-3">
        <div className="mb-2">
          <p className="text-sm font-medium text-slate-700">Các lựa chọn (chọn đáp án đúng)</p>
          <p className="text-xs text-brand-600 italic">Mẹo: Dùng $$ công thức $$ để gõ Toán học. Ví dụ: $$\frac{1}{2}$$</p>
        </div>
        {options.map((opt, i) => {
          const label = String.fromCharCode(65 + i);
          return (
            <div key={i} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onChange({ selected: [label], options })}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${correct === label ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-brand-100'}`}
              >
                {label}
              </button>
              <input
                type="text"
                value={opt}
                onChange={e => {
                  const newOpts = [...options];
                  newOpts[i] = e.target.value;
                  onChange({ selected: [correct], options: newOpts });
                }}
                placeholder={`Lựa chọn ${label}`}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
            </div>
          );
        })}
        <p className="text-xs text-slate-400">Nhấn vào chữ cái để chọn đáp án đúng (hiện tại: <strong>{correct}</strong>)</p>
      </div>
    );
  }

  if (type === 'true_false') {
    const statements = correct_answer?.statements || ['', ''];
    const answers = correct_answer?.answers || {};
    const addStatement = () => onChange({ ...correct_answer, statements: [...statements, ''], answers });
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Các mệnh đề</p>
            <p className="text-xs text-brand-600 italic">Mẹo: Dùng $$ công thức $$ để gõ Toán học.</p>
          </div>
          <button type="button" onClick={addStatement} className="text-xs text-brand-600 hover:underline">+ Thêm mệnh đề</button>
        </div>
        {statements.map((stmt, i) => {
          const id = String(i + 1);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-5 text-xs font-bold text-slate-500">{id}.</span>
              <input
                type="text"
                value={stmt}
                onChange={e => {
                  const s = [...statements]; s[i] = e.target.value;
                  onChange({ ...correct_answer, statements: s, answers });
                }}
                placeholder={`Mệnh đề ${id}`}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
              <div className="flex gap-1">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => onChange({ ...correct_answer, statements, answers: { ...answers, [id]: v } })}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${answers[id] === v ? (v ? 'bg-green-500 text-white' : 'bg-red-500 text-white') : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {v ? 'Đ' : 'S'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (type === 'short_answer') {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Các đáp án được chấp nhận (cách nhau bởi dấu phẩy)</label>
          <input
            type="text"
            value={(correct_answer?.accepted || []).join(', ')}
            onChange={e => onChange({ ...correct_answer, accepted: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="ví dụ: 12.3, 12,3, 12.30"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">Hệ thống sẽ tự chuẩn hóa (xóa khoảng trắng thừa, đổi phẩy thành chấm, viết thường) trước khi chấm.</p>
        </div>
      </div>
    );
  }

  if (type === 'essay') {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1 block">Đáp án mẫu</label>
          <RichTextEditor
            value={correct_answer?.sample || ''}
            onChange={val => onChange({ ...correct_answer, sample: val })}
            placeholder="Viết đáp án mẫu để tham khảo..."
            minHeight="100px"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Từ khóa chấm điểm (cách nhau bởi dấu phẩy)</label>
          <input
            type="text"
            value={(correct_answer?.keywords || []).join(', ')}
            onChange={e => onChange({ ...correct_answer, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="ví dụ: lập trình, thuật toán, biến"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>
      </div>
    );
  }
  return null;
};

// ── Modal thêm/sửa câu hỏi ───────────────────────────────────────
const QuestionModal = ({ question, subjects, onSave, onClose }) => {
  const [form, setForm] = useState(() => {
    let initialAnswer = { selected: ['A'], options: ['', '', '', ''] };
    if (question) {
      console.log('DEBUG question:', question);
      if (question.type === 'multiple_choice') {
        const mappedOptions = question.options 
          ? question.options.map(o => typeof o === 'string' ? o : o.text) 
          : ['', '', '', ''];
          
        // Thử parse nếu backend trả về chuỗi JSON
        let ca = question.correct_answer;
        if (typeof ca === 'string' && ca.startsWith('{')) {
          try { ca = JSON.parse(ca); } catch(e){}
        }

        let sel = ca?.selected || [ca];
        let mappedSelected = 'A';
        if (Array.isArray(sel) && sel.length > 0 && sel[0] !== undefined && sel[0] !== null) {
          let val = sel[0];
          // Nếu là số (index) -> convert sang chữ A, B, C, D
          if (typeof val === 'number' || (typeof val === 'string' && !isNaN(val) && val.trim() !== '')) {
            mappedSelected = String.fromCharCode(65 + parseInt(val));
          } else {
            mappedSelected = String(val).toUpperCase();
          }
        }
        
        console.log('DEBUG mappedSelected:', mappedSelected, 'from', ca);

        initialAnswer = {
          selected: [mappedSelected],
          options: mappedOptions
        };
      } else if (question.type === 'true_false') {
        initialAnswer = {
          statements: question.options ? question.options.map(o => o.statement || '') : ['', '', '', ''],
          answers: question.correct_answer?.answers || {}
        };
      } else if (question.type === 'essay') {
        initialAnswer = {
          sample: question.correct_answer?.sample || (typeof question.correct_answer === 'string' ? question.correct_answer : ''),
          keywords: question.correct_answer?.keywords || []
        };
      } else if (question.type === 'short_answer') {
        initialAnswer = {
          accepted: question.correct_answer?.accepted || []
        };
      }
    }

    return {
      subject_id: question?.subject_id || (subjects[0]?.id || ''),
      difficulty: question?.difficulty || 'nhan_biet',
      type: question?.type || 'multiple_choice',
      content: question?.content || '',
      score: question?.score || 1,
      correct_answer: initialAnswer,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  const handleTypeChange = (type) => {
    const defaultAnswer = type === 'multiple_choice' ? { selected: ['A'], options: ['', '', '', ''] }
      : type === 'true_false' ? { statements: ['', '', '', ''], answers: {'1':true,'2':false,'3':true,'4':false} }
      : type === 'short_answer' ? { accepted: [] }
      : { sample: '', keywords: [] };
    setForm(f => ({ ...f, type, correct_answer: defaultAnswer }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.content.trim()) return setError('Vui lòng nhập nội dung câu hỏi');
    if (form.content.trim().length < 10) return setError('Nội dung câu hỏi phải có ít nhất 10 ký tự');
    if (!form.subject_id) return setError('Vui lòng chọn môn học');
    setSaving(true); setError('');
    try {
      // Transform correct_answer + options sang đúng format backend
      let payload = { ...form };

      if (form.type === 'multiple_choice') {
        const opts = form.correct_answer?.options || ['', '', '', ''];
        // options backend: [{id:"A",text:"..."}, ...]
        payload.options = opts.map((text, i) => ({ id: String.fromCharCode(65+i), text }));
        // correct_answer backend: {"selected":["A"]}
        payload.correct_answer = { selected: form.correct_answer?.selected || ['A'] };
      }

      if (form.type === 'true_false') {
        const stmts = form.correct_answer?.statements || [];
        // options backend: [{id:"1",statement:"..."}, ...]
        payload.options = stmts.map((s, i) => ({ id: String(i+1), statement: s }));
        // correct_answer backend: {"answers":{"1":true,"2":false,...}}
        payload.correct_answer = { answers: form.correct_answer?.answers || {} };
      }

      if (form.type === 'essay') {
        payload.options = null;
        // correct_answer: {"sample":"...","keywords":[...]}
        payload.correct_answer = {
          sample: form.correct_answer?.sample || '',
          keywords: form.correct_answer?.keywords || [],
        };
      }

      if (form.type === 'short_answer') {
        payload.options = null;
        payload.correct_answer = {
          accepted: form.correct_answer?.accepted || [],
        };
      }

      if (question?.id) {
        await questionService.update(question.id, payload);
      } else {
        await questionService.create(payload);
      }
      onSave();
    } catch (err) {
      // Xử lý lỗi trùng lặp (HTTP 409) riêng biệt
      if (err.status === 409 && err.data?.duplicate) {
        setDuplicateInfo(err.data.duplicate);
        setError(err.data.message || 'Nội dung câu hỏi bị trùng lặp');
      } else {
        setDuplicateInfo(null);
        setError(err.message || 'Không thể lưu câu hỏi');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{question?.id ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Thông báo lỗi thường */}
          {error && !duplicateInfo && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Thông báo trùng lặp */}
          {duplicateInfo && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800">Câu hỏi bị trùng lặp!</p>
                  <p className="mt-0.5 text-sm text-amber-700">{error}</p>
                  <div className="mt-2 rounded-lg border border-amber-200 bg-white p-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      Câu hỏi đã tồn tại (do <strong>{duplicateInfo.created_by_name}</strong> tạo
                      {duplicateInfo.is_approved ? ' — đã duyệt ✅' : ' — chưa duyệt ⏳'}):
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-3 italic">"{duplicateInfo.content.replace(/<[^>]+>/g,'').substring(0,200)}{duplicateInfo.content.length > 200 ? '...' : ''}"</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDuplicateInfo(null)}
                    className="mt-2 text-xs text-amber-600 underline"
                  >
                    Xem nhưng vẫn muốn lưu (bỏ qua cảnh báo)
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-slate-600">Môn học</label>
              <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Loại câu hỏi</label>
              <select value={form.type} onChange={e => handleTypeChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Độ khó</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Điểm</label>
              <input type="number" min={0.25} max={10} step={0.25} value={form.score}
                onChange={e => setForm(f => ({ ...f, score: parseFloat(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung câu hỏi <span className="text-red-500">*</span></label>
              <RichTextEditor 
                value={form.content} 
                onChange={val => setForm(f => ({ ...f, content: val }))}
                placeholder="Nhập nội dung câu hỏi (hỗ trợ KaTeX $$...$$)..." 
                minHeight="200px"
              />
            </div>
            
            {/* Live Preview */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-slate-700 mb-1">Xem trước giao diện hiển thị</label>
              <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 p-4 overflow-y-auto" style={{ minHeight: '200px' }}>
                {form.content ? (
                  <MathViewer htmlContent={form.content} className="text-slate-900" />
                ) : (
                  <span className="text-sm italic text-slate-400">Giao diện xem trước câu hỏi sẽ hiển thị ở đây...</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Đáp án & cấu hình</p>
            <AnswerSection type={form.type} correct_answer={form.correct_answer}
              onChange={ca => setForm(f => ({ ...f, correct_answer: ca }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : question?.id ? 'Cập nhật' : 'Thêm câu hỏi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Trang chính ───────────────────────────────────────────────────
const QuestionBank = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ subject_id: '', difficulty: '', type: '', is_approved: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const isHead = user?.role === 'department_head' || user?.role === 'admin';

  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => { loadQuestions(); }, [filters, page]);

  const loadSubjects = async () => {
    try {
      if (user?.role === 'teacher') {
        const assigned = await teacherSubjectService.getMySubjects();
        const subs = assigned.map(s => ({ id: s.subject_id, name: s.subject_name, grade: s.grade }));
        setSubjects(subs.length > 0 ? subs : await subjectService.getAll());
      } else {
        setSubjects(await subjectService.getAll());
      }
    } catch {}
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')), page, limit: LIMIT };
      const data = await questionService.getAll(params);
      setQuestions(data.questions || data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa câu hỏi này?')) return;
    try { await questionService.delete(id); loadQuestions(); } catch (e) { alert(e.message); }
  };

  const handleApprove = async (id) => {
    try { await questionService.approve(id); loadQuestions(); } catch (e) { alert(e.message); }
  };

  const handleReject = async (id) => {
    try { await questionService.reject(id); loadQuestions(); } catch (e) { alert(e.message); }
  };

  // Màu badge — 3 mức theo CV 7991
  const diffColor = {
    nhan_biet:  'bg-green-100 text-green-700',
    thong_hieu: 'bg-blue-100 text-blue-700',
    van_dung:   'bg-amber-100 text-amber-700',
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Ngân hàng câu hỏi</h2>
          <p className="text-sm text-slate-500">{total} câu hỏi</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          + Thêm câu hỏi
        </button>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm">
        <select value={filters.subject_id} onChange={e => { setFilters(f => ({ ...f, subject_id: e.target.value })); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
          <option value="">Tất cả môn</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.difficulty} onChange={e => { setFilters(f => ({ ...f, difficulty: e.target.value })); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
          <option value="">Tất cả độ khó</option>
          {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select value={filters.type} onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
          <option value="">Tất cả loại</option>
          {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {isHead && (
          <select value={filters.is_approved} onChange={e => { setFilters(f => ({ ...f, is_approved: e.target.value })); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
            <option value="">Tất cả trạng thái</option>
            <option value="false">Chờ duyệt</option>
            <option value="true">Đã duyệt</option>
          </select>
        )}
      </div>

      {/* Bảng câu hỏi */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Đang tải...</div>
        ) : questions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Không có câu hỏi nào</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Nội dung</th>
                <th className="px-4 py-3 text-left">Môn / Loại</th>
                <th className="px-4 py-3 text-left">Độ khó</th>
                <th className="px-4 py-3 text-left">Điểm</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {questions.map(q => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="max-w-xs px-4 py-3">
                    <MathViewer htmlContent={q.content} className="line-clamp-2 text-slate-900" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-500">{q.subject_name || '—'}</p>
                    <p className="text-xs font-medium text-slate-700">{TYPES[q.type] || q.type}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${diffColor[q.difficulty] || 'bg-slate-100 text-slate-600'}`}>
                      {LEVEL_LABEL[q.difficulty] || q.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{q.score}</td>
                  <td className="px-4 py-3">
                    {q.is_approved
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Đã duyệt</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">⏳ Chờ duyệt</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 text-xs">
                      <button onClick={() => { setEditing(q); setShowModal(true); }} className="text-blue-600 hover:underline">Sửa</button>
                      {isHead && !q.is_approved && (
                        <button onClick={() => handleApprove(q.id)} className="text-green-600 hover:underline">Duyệt</button>
                      )}
                      {isHead && q.is_approved && (
                        <button onClick={() => handleReject(q.id)} className="text-yellow-600 hover:underline">Thu hồi</button>
                      )}
                      <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:underline">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Trang {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">← Trước</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Tiếp →</button>
          </div>
        </div>
      )}

      {showModal && (
        <QuestionModal
          question={editing}
          subjects={subjects}
          onSave={() => { setShowModal(false); loadQuestions(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default QuestionBank;
