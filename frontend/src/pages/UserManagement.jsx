import { useState, useEffect, useCallback } from 'react';
import { userService, classService, subjectService, teacherSubjectService, classSubjectService } from '../services/api';

// ── Hằng số ───────────────────────────────────────────────────────
const ROLES = {
  admin:           { label: 'Quản trị viên', color: 'bg-red-100 text-red-700' },
  department_head: { label: 'Tổ trưởng',     color: 'bg-blue-100 text-blue-700' },
  teacher:         { label: 'Giáo viên',      color: 'bg-emerald-100 text-emerald-700' },
  student:         { label: 'Học sinh',       color: 'bg-slate-100 text-slate-600' },
};

// ════════════════════════════════════════════════════════════════
// MODAL: Thêm / Sửa người dùng
// ════════════════════════════════════════════════════════════════
const UserFormModal = ({ user, classes, subjects, onSave, onClose }) => {
  const [form, setForm] = useState({
    full_name:   user?.full_name || '',
    email:       user?.email     || '',
    password:    '',
    role:        user?.role      || 'student',
    class_id:    user?.class_id  || '',
    subject_ids: user?.subject_ids || [], // [MỚI] Tổ hợp môn của học sinh
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [combo, setCombo]   = useState('custom');

  // Lấy danh sách môn học theo khối của lớp đang chọn
  const selectedClassObj = classes.find(c => c.id === form.class_id);
  const grade = selectedClassObj?.grade;
  const gradeSubjects = subjects.filter(s => s.grade === grade);
  const compulsorySubjects = gradeSubjects.filter(s => s.category === 'bat_buoc');
  const electiveSubjects = gradeSubjects.filter(s => s.category !== 'bat_buoc');

  const handleComboChange = (comboId) => {
    setCombo(comboId);
    if (!grade) return;
    
    // Luôn lấy các môn bắt buộc
    const compulsoryIds = compulsorySubjects.map(s => s.id);
    let newSubjectIds = [...compulsoryIds];

    if (comboId === 'khtn') {
      // Tự nhiên: KHTN + Tin học
      newSubjectIds.push(...electiveSubjects.filter(s => s.category === 'khtn' || s.name.includes('Tin học')).map(s => s.id));
    } else if (comboId === 'khxh') {
      // Xã hội: KHXH + Tin học
      newSubjectIds.push(...electiveSubjects.filter(s => s.category === 'khxh' || s.name.includes('Tin học')).map(s => s.id));
    }
    // Nếu custom thì giữ nguyên subject_ids hiện tại (có thể thêm bớt sau)
    
    if (comboId !== 'custom') {
      setForm(f => ({ ...f, subject_ids: newSubjectIds }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) return setError('Vui lòng nhập họ tên');
    if (!form.email.trim())     return setError('Vui lòng nhập email');
    if (!user && !form.password) return setError('Vui lòng nhập mật khẩu');
    if (form.role === 'student' && !form.class_id) return setError('Vui lòng chọn lớp cho học sinh');

    setSaving(true); setError('');
    try {
      let finalSubjectIds = form.role === 'student' ? form.subject_ids : [];
      // Đảm bảo môn bắt buộc luôn có
      if (form.role === 'student' && grade) {
        const compulsoryIds = compulsorySubjects.map(s => s.id);
        finalSubjectIds = [...new Set([...finalSubjectIds, ...compulsoryIds])];
      }

      const payload = {
        full_name: form.full_name.trim(),
        email:     form.email.trim(),
        role:      form.role,
        class_id:  form.role === 'student' ? (form.class_id || null) : null,
        subject_ids: finalSubjectIds,
      };
      if (!user) payload.password = form.password;

      if (user) await userService.update(user.id, payload);
      else      await userService.create(payload);
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold">{user ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên <span className="text-red-500">*</span></label>
            <input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò</label>
            <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value, class_id: ''}))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
              {Object.entries(ROLES).map(([v, {label}]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>

          {form.role === 'student' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lớp <span className="text-red-500">*</span></label>
                <select value={form.class_id} onChange={e => setForm(f => ({...f, class_id: e.target.value}))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
                  <option value="">-- Chọn lớp --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} (Khối {c.grade} — {c.school_year})</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tổ hợp môn học (GDPT 2018)</label>
                {grade ? (
                  <div className="space-y-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">1. Các môn bắt buộc (Mặc định)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {compulsorySubjects.map(sub => (
                          <span key={sub.id} className="inline-flex items-center px-2 py-1 rounded bg-slate-200 text-xs font-medium text-slate-700">
                            ✓ {sub.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">2. Các môn tự chọn</p>
                      <select 
                        value={combo} 
                        onChange={e => handleComboChange(e.target.value)}
                        className="w-full mb-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
                      >
                        <option value="custom">-- Chọn tổ hợp có sẵn hoặc Tùy chọn --</option>
                        <option value="khtn">Khối Tự nhiên (Lý, Hóa, Sinh, Tin học)</option>
                        <option value="khxh">Khối Xã hội (Địa lý, GD KTPL, Tin học)</option>
                      </select>

                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {electiveSubjects.map(sub => (
                          <label key={sub.id} className="flex items-center gap-2 cursor-pointer text-sm p-1.5 rounded bg-white border border-slate-100 hover:border-brand-300 transition">
                            <input 
                              type="checkbox" 
                              checked={form.subject_ids.includes(sub.id)}
                              onChange={(e) => {
                                setCombo('custom'); // Chuyển về custom nếu tự chỉnh tay
                                const isChecked = e.target.checked;
                                setForm(f => ({
                                  ...f, 
                                  subject_ids: isChecked 
                                    ? [...f.subject_ids, sub.id]
                                    : f.subject_ids.filter(id => id !== sub.id)
                                }));
                              }}
                              className="rounded accent-brand-600 border-slate-300"
                            />
                            <span className="text-slate-700 leading-tight">{sub.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">Vui lòng chọn lớp để hiển thị tổ hợp môn.</p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : user ? 'Cập nhật' : 'Thêm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MODAL: Import Excel danh sách học sinh
// ════════════════════════════════════════════════════════════════
const ImportStudentModal = ({ classes, onSave, onClose }) => {
  const [classId, setClassId]   = useState(classes[0]?.id || '');
  const [file, setFile]         = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  // Parse Excel ngay trên client để preview trước khi import
  const [preview, setPreview]   = useState([]);
  const [parsing, setParsing]   = useState(false);

  const handleFile = async (f) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) { setError('Chỉ chấp nhận file .xlsx hoặc .xls'); return; }
    setFile(f); setError(''); setPreview([]); setResult(null);
    setParsing(true);
    try {
      // Đọc file bằng FileReader → gửi lên server parse
      const fd = new FormData();
      fd.append('file', f);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/parse-students`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi đọc file');
      setPreview(data.students || []);
    } catch (e) { setError(e.message); }
    finally { setParsing(false); }
  };

  const handleImport = async () => {
    if (!classId) return setError('Vui lòng chọn lớp');
    if (!file)    return setError('Vui lòng chọn file');
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('class_id', classId);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/users/import-students`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi import');
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Import danh sách học sinh</h3>
            <p className="text-xs text-slate-500 mt-0.5">Upload file Excel theo mẫu</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Tải template */}
          <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-blue-800">Chưa có file mẫu?</p>
              <p className="text-xs text-blue-600">Cột bắt buộc: full_name, email · Tùy chọn: password</p>
            </div>
            <a href="/template_hocsinh.xlsx" download
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              ↓ Tải template
            </a>
          </div>

          {/* Chọn lớp */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lớp <span className="text-red-500">*</span></label>
            <select value={classId} onChange={e => setClassId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
              <option value="">-- Chọn lớp --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} (Khối {c.grade} — {c.school_year})</option>)}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById('importStudentFile').click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 transition
              ${dragOver ? 'border-brand-400 bg-brand-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50'}`}
          >
            <input id="importStudentFile" type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
            <div className="mb-2 text-3xl">{parsing ? '⏳' : file ? '📄' : '☁️'}</div>
            {parsing ? <p className="text-sm text-slate-500">Đang đọc file...</p>
              : file ? (
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size/1024).toFixed(1)} KB · {preview.length} học sinh</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null); setPreview([]); }}
                    className="mt-1 text-xs text-red-500 hover:underline">Chọn file khác</button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Kéo thả file vào đây</p>
                  <p className="text-xs text-slate-400 mt-1">hoặc click để chọn .xlsx</p>
                </div>
              )}
          </div>

          {/* Preview danh sách */}
          {preview.length > 0 && !result && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Xem trước ({preview.length} học sinh):</p>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Họ tên</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((s, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-2 text-slate-800">{s.full_name}</td>
                        <td className="px-3 py-2 text-slate-600">{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kết quả */}
          {result && (
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="font-semibold text-emerald-800">{result.message}</p>
              {result.errors?.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">• Dòng {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            {result ? 'Đóng' : 'Hủy'}
          </button>
          {!result && (
            <button onClick={handleImport} disabled={!file || !classId || uploading || parsing}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">
              {uploading ? 'Đang import...' : `Import ${preview.length > 0 ? preview.length + ' học sinh' : ''}`}
            </button>
          )}
          {result && (
            <button onClick={onSave}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              ✓ Xem danh sách
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


// ════════════════════════════════════════════════════════════════
// MODAL: Phân công môn học cho giáo viên / tổ trưởng
// ════════════════════════════════════════════════════════════════
const AssignSubjectModal = ({ user, subjects, subjectNames, onSave, onClose }) => {
  const isHead     = user.role === 'department_head';
  const isTeacher  = user.role === 'teacher';

  const [selected, setSelected] = useState(() => {
    if (isTeacher) return (user.assigned_subjects || []).map(s => s.subject_id);
    if (isHead)    return (user.assigned_subjects || []).map(s => s.subject_name);
    return [];
  });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (isTeacher) {
          const subs = await teacherSubjectService.getByTeacher(user.id);
          setSelected(subs.map(s => s.subject_id));
        } else {
          const subs = await teacherSubjectService.getByHead(user.id);
          setSelected(subs.map(s => s.subject_name));
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [user.id]);

  const toggle = (val) =>
    setSelected(p => p.includes(val) ? p.filter(v => v !== val) : [...p, val]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (isTeacher) {
        await teacherSubjectService.assignToTeacher(user.id, selected);
      } else {
        await teacherSubjectService.assignToHead(user.id, selected);
      }
      onSave();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const options = isTeacher ? subjects : subjectNames.map(n => ({ id: n, label: n }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Phân công môn học</h3>
            <p className="text-xs text-slate-500 mt-0.5">{user.full_name} · {ROLES[user.role]?.label}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="py-6 text-center text-sm text-slate-400">Đang tải...</div>
          ) : (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">
                {isTeacher ? 'Chọn môn học được phép tạo đề:' : 'Chọn môn bộ môn phụ trách:'}
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {isTeacher ? subjects.map(s => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition">
                    <input type="checkbox" checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 rounded accent-brand-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">Khối {s.grade}</p>
                    </div>
                  </label>
                )) : subjectNames.map(name => (
                  <label key={name} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition">
                    <input type="checkbox" checked={selected.includes(name)}
                      onChange={() => toggle(name)}
                      className="h-4 w-4 rounded accent-brand-600" />
                    <p className="text-sm font-medium text-slate-800">{name} (tất cả khối)</p>
                  </label>
                ))}
              </div>
              {selected.length > 0 && (
                <p className="mt-3 text-xs text-emerald-600 font-medium">
                  ✓ Đã chọn {selected.length} {isTeacher ? 'môn học' : 'bộ môn'}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Hủy</button>
            <button onClick={handleSave} disabled={saving || loading}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu phân công'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// TRANG CHÍNH
// ════════════════════════════════════════════════════════════════
const UserManagement = ({ defaultRole }) => {
  const [users, setUsers]           = useState([]);
  const [classes, setClasses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAssign, setShowAssign] = useState(null);
  const [editing, setEditing]       = useState(null);
  const [filterRole, setFilterRole] = useState(defaultRole || '');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  // Cập nhật filterRole khi prop defaultRole thay đổi
  useEffect(() => {
    if (defaultRole) {
      setFilterRole(defaultRole);
      setFilterClass('');
      setFilterSubject('');
    }
  }, [defaultRole]);

  const [search, setSearch]         = useState('');
  const [allSubjects, setAllSubjects] = useState([]);
  const [subjectNames, setSubjectNames] = useState([]);
  const [teacherAssignments, setTeacherAssignments] = useState([]);
  const [headAssignments, setHeadAssignments] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);

  const [mainPage, setMainPage] = useState(1);
  const MAIN_ITEMS_PER_PAGE = 10;

  useEffect(() => { loadData(); loadSubjectNames(); loadAllSubjects(); }, []);

  const loadAllSubjects = async () => {
    try {
      const subs = await subjectService.getAll();
      setAllSubjects(Array.isArray(subs) ? subs : []);
    } catch {}
  };

  const loadSubjectNames = async () => {
    try {
      const names = await teacherSubjectService.getSubjectNames();
      setSubjectNames(names);
    } catch {}
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, cRes, tRes, csRes] = await Promise.all([
        userService.getAll(),
        classService.getAll(),
        teacherSubjectService.getAll().catch(() => []),
        classSubjectService.getAll().catch(() => []),
      ]);
      setUsers(uRes.users || uRes || []);
      setClasses(cRes || []);
      setTeacherAssignments(tRes?.assignments || []);
      setHeadAssignments(tRes?.headAssignments || []);
      setClassSubjects(csRes || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDeactivate = async (user) => {
    if (!confirm(`Khóa tài khoản "${user.full_name}"?`)) return;
    try { await userService.deactivate(user.id); loadData(); }
    catch (e) { alert(e.message); }
  };

  const handleActivate = async (user) => {
    if (!confirm(`Mở khóa tài khoản "${user.full_name}"?`)) return;
    try { await userService.activate(user.id); loadData(); }
    catch (e) { alert(e.message); }
  };

  const filtered = users.filter(u => {
    if (filterRole  && u.role     !== filterRole)  return false;
    if (filterClass && String(u.class_id) !== filterClass) return false;

    if (filterSubject) {
      if (u.role === 'teacher') {
        const hasSub = teacherAssignments.some(a => a.teacher_id === u.id && String(a.subject_id) === filterSubject);
        if (!hasSub) return false;
      } else if (u.role === 'department_head') {
        const hasSub = headAssignments.some(a => a.head_id === u.id && a.subject_name === filterSubject);
        if (!hasSub) return false;
      }
    }

    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())
               && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (a.role === 'teacher' && b.role === 'teacher') {
      const aSub = a.teacher_subjects_list ? a.teacher_subjects_list.replace(/ \d+/g, '') : 'ZZZ';
      const bSub = b.teacher_subjects_list ? b.teacher_subjects_list.replace(/ \d+/g, '') : 'ZZZ';
      if (aSub < bSub) return -1;
      if (aSub > bSub) return 1;
      return a.full_name.localeCompare(b.full_name);
    }
    if (a.role === 'student' && b.role === 'student') {
      const aClass = a.class_name || 'ZZZ';
      const bClass = b.class_name || 'ZZZ';
      if (aClass < bClass) return -1;
      if (aClass > bClass) return 1;
      return a.full_name.localeCompare(b.full_name);
    }
    return a.role.localeCompare(b.role) || a.full_name.localeCompare(b.full_name);
  });

  useEffect(() => {
    setMainPage(1);
  }, [filterRole, filterClass, filterSubject, search]);

  const mainTotalPages = Math.ceil(filtered.length / MAIN_ITEMS_PER_PAGE) || 1;
  const paginatedUsers = filtered.slice((mainPage - 1) * MAIN_ITEMS_PER_PAGE, mainPage * MAIN_ITEMS_PER_PAGE);

  const countByRole = (role) => users.filter(u => u.role === role).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Quản lý {defaultRole ? ROLES[defaultRole]?.label.toLowerCase() : 'người dùng'}
          </h2>
          <p className="text-sm text-slate-500">
            {filtered.length} {defaultRole ? ROLES[defaultRole]?.label.toLowerCase() : 'tài khoản'} trong hệ thống
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="rounded-xl border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50">
            ↑ Import học sinh
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            + Thêm tài khoản
          </button>
        </div>
      </div>

      {/* Thống kê nhanh */}
      {!defaultRole && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(ROLES).map(([role, {label, color}]) => (
            <button key={role} onClick={() => { setFilterRole(filterRole === role ? '' : role); setFilterClass(''); setFilterSubject(''); }}
              className={`rounded-xl border p-4 text-left transition hover:shadow-sm
                ${filterRole === role ? 'border-brand-400 bg-brand-50' : 'bg-white border-slate-100'}`}>
              <p className="text-2xl font-bold text-slate-900">{countByRole(role)}</p>
              <p className="mt-1 text-xs text-slate-500">{label}</p>
              <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>
                {filterRole === role ? 'Đang lọc' : 'Click để lọc'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Bộ lọc */}
      <div className="flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm tên hoặc email..."
          className="flex-1 min-w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" />
        <div className="flex flex-wrap gap-3">
          {!defaultRole && (
            <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setFilterClass(''); setFilterSubject(''); }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
              <option value="">Tất cả vai trò</option>
              {Object.entries(ROLES).map(([v, {label}]) => <option key={v} value={v}>{label}</option>)}
            </select>
          )}

          {(!filterRole || filterRole === 'student') && (
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
              <option value="">Tất cả lớp</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {filterRole === 'teacher' && (
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none max-w-[200px]">
              <option value="">Tất cả môn học</option>
              {allSubjects.map(s => <option key={s.id} value={s.id}>{s.name} (Khối {s.grade})</option>)}
            </select>
          )}

          {filterRole === 'department_head' && (
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none">
              <option value="">Tất cả môn học</option>
              {subjectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Bảng danh sách */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">Đang tải...</div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Họ tên</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vai trò</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Lớp / Phụ trách</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</th>
                  {defaultRole === 'student' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tổ hợp môn</th>
                  )}
                  {defaultRole === 'teacher' && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Môn giảng dạy</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={defaultRole === 'admin' ? 6 : 7} className="py-12 text-center text-sm text-slate-400">Không có tài khoản nào phù hợp</td></tr>
                ) : paginatedUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLES[u.role]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {ROLES[u.role]?.label || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {u.role === 'student' ? (
                        u.class_name ? (
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium">{u.class_name}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )
                      ) : (u.role === 'teacher' || u.role === 'department_head') ? (
                        (() => {
                          const tClasses = Array.from(new Set(classSubjects.filter(cs => cs.teacher_id === u.id).map(cs => cs.class_name)));
                          const hAssigns = u.role === 'department_head' ? headAssignments.filter(a => a.head_id === u.id) : [];
                          
                          if (tClasses.length === 0 && hAssigns.length === 0) return <span className="text-slate-300">—</span>;
                          return (
                            <div className="flex flex-col gap-1.5 max-w-[250px]">
                              {hAssigns.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">Tổ trưởng:</span>
                                  {hAssigns.map(a => (
                                    <span key={a.id} className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700 whitespace-nowrap">
                                      {a.subject_name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {tClasses.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1">
                                  {u.role === 'department_head' && <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">Dạy:</span>}
                                  {tClasses.slice(0, 2).map((className, idx) => (
                                    <span key={idx} title={className} className="rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700 whitespace-nowrap">
                                      {className}
                                    </span>
                                  ))}
                                  {tClasses.length > 2 && (
                                    <span 
                                      title={tClasses.slice(2).join('\n')}
                                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium cursor-help"
                                    >
                                      +{tClasses.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                          );
                        })()
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold
                        ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    {defaultRole === 'student' && (
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {u.subject_ids && u.subject_ids.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {u.subject_ids
                              .map(id => allSubjects.find(s => s.id === id))
                              .filter(s => s && s.category !== 'bat_buoc')
                              .map(s => (
                                <span key={s.id} className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 whitespace-nowrap">
                                  {s.name.replace(/ \d+$/, '')}
                                </span>
                              ))}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    )}
                    {defaultRole === 'teacher' && (
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {u.teacher_subjects_list ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {Array.from(new Set(u.teacher_subjects_list.split(', ').map(sub => sub.replace(/ \d+$/, '')))).map((sub, idx) => (
                              <span key={idx} className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 whitespace-nowrap">
                                {sub}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditing(u); setShowForm(true); }}
                        className="mr-2 text-xs font-medium text-brand-600 hover:underline">Sửa</button>
                      {(u.role === 'teacher' || u.role === 'department_head') && (
                        <button onClick={() => setShowAssign(u)}
                          className="mr-2 text-xs font-medium text-violet-600 hover:underline">Phân công</button>
                      )}
                      {u.is_active ? (
                        <button onClick={() => handleDeactivate(u)}
                          className="text-xs font-medium text-red-500 hover:underline">Khóa</button>
                      ) : (
                        <button onClick={() => handleActivate(u)}
                          className="text-xs font-medium text-emerald-600 hover:underline">Mở khóa</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > MAIN_ITEMS_PER_PAGE && (
            <div className="border-t px-4 py-3 flex justify-between items-center bg-slate-50">
              <span className="text-xs text-slate-500">
                Hiển thị {paginatedUsers.length} / {filtered.length} tài khoản phù hợp
              </span>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setMainPage(p => Math.max(1, p - 1))}
                  disabled={mainPage === 1}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
                >
                  Trước
                </button>
                <span className="text-sm font-medium text-slate-600">
                  {mainPage} / {mainTotalPages}
                </span>
                <button 
                  onClick={() => setMainPage(p => Math.min(mainTotalPages, p + 1))}
                  disabled={mainPage === mainTotalPages}
                  className="px-3 py-1.5 text-sm font-medium rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
          {filtered.length > 0 && filtered.length <= MAIN_ITEMS_PER_PAGE && (
            <div className="border-t px-4 py-3 text-xs text-slate-400">
              Hiển thị {filtered.length} tài khoản phù hợp
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <UserFormModal
          user={editing}
          classes={classes}
          subjects={allSubjects}
          onSave={() => { setShowForm(false); loadData(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {showAssign && (showAssign.role === 'teacher' || showAssign.role === 'department_head') && (
        <AssignSubjectModal
          user={showAssign}
          subjects={allSubjects}
          subjectNames={subjectNames}
          onSave={() => { setShowAssign(null); }}
          onClose={() => setShowAssign(null)}
        />
      )}

      {showImport && (
        <ImportStudentModal
          classes={classes}
          onSave={() => { setShowImport(false); loadData(); }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
};

export default UserManagement;
