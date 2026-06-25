import { useState, useEffect } from 'react';
import { subjectService } from '../services/api';

const SubjectManagement = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    grade: 10,
    category: 'bat_buoc',
    description: ''
  });

  const CATEGORY_LABELS = {
    bat_buoc: 'Bắt buộc',
    khtn: 'Lựa chọn (KHTN)',
    khxh: 'Lựa chọn (KHXH)',
    cong_nghe_nt: 'Lựa chọn (CN & NT)',
    chuyen_de: 'Chuyên đề',
    tu_chon: 'Tự chọn'
  };

  const [mainPage, setMainPage] = useState(1);
  const MAIN_ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await subjectService.getAll();
      setSubjects(data);
    } catch (err) {
      setError('Không thể tải danh sách môn học');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const mainTotalPages = Math.ceil(subjects.length / MAIN_ITEMS_PER_PAGE) || 1;
  const paginatedSubjects = subjects.slice((mainPage - 1) * MAIN_ITEMS_PER_PAGE, mainPage * MAIN_ITEMS_PER_PAGE);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSubject) {
        await subjectService.update(editingSubject.id, formData);
      } else {
        await subjectService.create(formData);
      }
      setShowModal(false);
      setEditingSubject(null);
      setFormData({ name: '', grade: 10, category: 'bat_buoc', description: '' });
      loadSubjects();
    } catch (err) {
      setError('Không thể lưu môn học');
      console.error(err);
    }
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      grade: subject.grade,
      category: subject.category || 'bat_buoc',
      description: subject.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (subjectId) => {
    if (window.confirm('Bạn có chắc muốn xóa môn học này?')) {
      try {
        await subjectService.delete(subjectId);
        loadSubjects();
      } catch (err) {
        setError('Không thể xóa môn học');
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-slate-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Quản lý môn học</h2>
          <p className="text-slate-600">Quản lý các môn học theo khối lớp</p>
        </div>
        <button
          onClick={() => {
            setEditingSubject(null);
            setFormData({ name: '', grade: 10, category: 'bat_buoc', description: '' });
            setShowModal(true);
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          Thêm môn học
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Tên môn</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Khối</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Nhóm môn</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Mô tả</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Số câu hỏi</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr><td colSpan="6" className="py-8 text-center text-sm text-slate-400">Không có môn học nào</td></tr>
              ) : paginatedSubjects.map((subject) => (
                <tr key={subject.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{subject.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{subject.grade}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                      {CATEGORY_LABELS[subject.category] || subject.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">
                    {subject.description || 'Không có mô tả'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {subject.question_count || 0} câu hỏi
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button
                      onClick={() => handleEdit(subject)}
                      className="mr-2 text-blue-600 hover:text-blue-800"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(subject.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {subjects.length > MAIN_ITEMS_PER_PAGE && (
        <div className="flex justify-center items-center gap-4">
          <button 
            onClick={() => setMainPage(p => Math.max(1, p - 1))}
            disabled={mainPage === 1}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
          >
            Trang trước
          </button>
          <span className="text-sm font-medium text-slate-600">
            Trang {mainPage} / {mainTotalPages}
          </span>
          <button 
            onClick={() => setMainPage(p => Math.min(mainTotalPages, p + 1))}
            disabled={mainPage === mainTotalPages}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
          >
            Trang tiếp
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {editingSubject ? 'Sửa môn học' : 'Thêm môn học'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên môn học</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ví dụ: Toán học"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Khối</label>
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  <option value={10}>10</option>
                  <option value={11}>11</option>
                  <option value={12}>12</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Nhóm môn</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                  rows={3}
                  placeholder="Mô tả về môn học..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
                >
                  {editingSubject ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectManagement;