import { useState, useEffect } from 'react';
import { classService, userService } from '../services/api';
import ClassSubjectModal from '../components/ClassSubjectModal';

const ClassManagement = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    grade: 10,
    school_year: '2025-2026'
  });
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [classForAssign, setClassForAssign] = useState(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentList, setStudentList] = useState([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({ full_name: '', email: '', class_id: '' });
  const [newStudentForm, setNewStudentForm] = useState({ full_name: '', email: '', password: 'student@123', class_id: '' });
  const [addStudentError, setAddStudentError] = useState(null);
  const [addStudentLoading, setAddStudentLoading] = useState(false);

  const [filterYear, setFilterYear] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [mainPage, setMainPage] = useState(1);
  const MAIN_ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadClasses();
  }, []);

  const uniqueYears = [...new Set(classes.map(c => c.school_year))].filter(Boolean).sort().reverse();

  const filteredClasses = classes.filter(c => {
    if (filterYear && c.school_year !== filterYear) return false;
    if (filterGrade && c.grade !== parseInt(filterGrade)) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    setMainPage(1);
  }, [filterYear, filterGrade, searchQuery]);

  const mainTotalPages = Math.ceil(filteredClasses.length / MAIN_ITEMS_PER_PAGE) || 1;
  const paginatedClasses = filteredClasses.slice((mainPage - 1) * MAIN_ITEMS_PER_PAGE, mainPage * MAIN_ITEMS_PER_PAGE);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await classService.getAll();
      setClasses(data);
    } catch (err) {
      setError('Không thể tải danh sách lớp học');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClass) {
        await classService.update(editingClass.id, formData);
      } else {
        await classService.create(formData);
      }
      setShowModal(false);
      setEditingClass(null);
      setFormData({ name: '', grade: 10, school_year: '2025-2026' });
      loadClasses();
    } catch (err) {
      setError('Không thể lưu lớp học');
      console.error(err);
    }
  };

  const handleEdit = (classItem) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      grade: classItem.grade,
      school_year: classItem.school_year
    });
    setShowModal(true);
  };

  const handleDelete = async (classId) => {
    if (window.confirm('Bạn có chắc muốn xóa lớp học này?')) {
      try {
        await classService.delete(classId);
        loadClasses();
      } catch (err) {
        setError('Không thể xóa lớp học');
        console.error(err);
      }
    }
  };

  const loadClassStudents = async (classItem, openModal = true) => {
    setStudentError(null);
    setStudentLoading(true);
    setSelectedClass(classItem);
    setEditingStudent(null);
    setStudentForm({ full_name: '', email: '', class_id: classItem.id });

    try {
      const students = await classService.getStudents(classItem.id);
      setStudentList(students);
      if (openModal) setStudentModalOpen(true);
    } catch (err) {
      setStudentError('Không thể tải danh sách học sinh');
      console.error(err);
    } finally {
      setStudentLoading(false);
    }
  };

  const downloadStudentCsv = (students, classItem) => {
    const rows = students.map((student) => [student.full_name, student.email, classItem.name]);
    const csv = [
      ['Họ tên', 'Email', 'Lớp'],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const bom = '\uFEFF'; // UTF-8 BOM để Excel nhận diện đúng encoding
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${classItem.name}_students.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenStudents = (classItem) => {
    loadClassStudents(classItem, true);
  };

  const handleDownloadStudents = async (classItem) => {
    setStudentError(null);
    setStudentLoading(true);
    try {
      const students = await classService.getStudents(classItem.id);
      downloadStudentCsv(students, classItem);
    } catch (err) {
      setStudentError('Không thể tải danh sách học sinh');
      console.error(err);
    } finally {
      setStudentLoading(false);
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setStudentForm({
      full_name: student.full_name,
      email: student.email,
      class_id: student.class_id || selectedClass?.id,
    });
  };

  const handleCancelEditStudent = () => {
    setEditingStudent(null);
    setStudentForm({ full_name: '', email: '', class_id: selectedClass?.id || '' });
  };

  const handleSaveStudent = async (studentId) => {
    try {
      const updatedStudent = await userService.update(studentId, studentForm);
      if (updatedStudent.class_id !== selectedClass?.id) {
        setStudentList((prev) => prev.filter((student) => student.id !== studentId));
        loadClasses();
      } else {
        setStudentList((prev) => prev.map((student) => (student.id === studentId ? updatedStudent : student)));
      }
      setEditingStudent(null);
    } catch (err) {
      setStudentError('Không thể cập nhật học sinh');
      console.error(err);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm('Xác nhận xóa học sinh khỏi lớp này?')) return;
    setStudentError(null);
    try {
      await userService.update(studentId, { class_id: null });
      setStudentList((prev) => prev.filter((student) => student.id !== studentId));
      loadClasses();
    } catch (err) {
      setStudentError('Không thể xóa học sinh khỏi lớp');
      console.error(err);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!selectedClass) return;

    setAddStudentError(null);
    setAddStudentLoading(true);

    try {
      await userService.create({
        ...newStudentForm,
        role: 'student',
        class_id: selectedClass.id,
      });
      await loadClassStudents(selectedClass, false);
      loadClasses();
      setNewStudentForm({ full_name: '', email: '', password: 'student@123', class_id: selectedClass.id });
    } catch (err) {
      setAddStudentError(err.message || 'Không thể thêm học sinh');
      console.error(err);
    } finally {
      setAddStudentLoading(false);
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
          <h2 className="text-2xl font-bold text-slate-900">Quản lý lớp học</h2>
          <p className="text-slate-600">Quản lý các lớp học trong trường</p>
        </div>
        <button
          onClick={() => {
            setEditingClass(null);
            setFormData({ name: '', grade: 10, school_year: '2025-2026' });
            setShowModal(true);
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
        >
          Thêm lớp học
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 rounded-xl bg-white p-4 shadow-sm">
        <input 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Tìm tên lớp..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none" 
        />
        <select 
          value={filterGrade} 
          onChange={e => setFilterGrade(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
        >
          <option value="">Tất cả khối</option>
          <option value="10">Khối 10</option>
          <option value="11">Khối 11</option>
          <option value="12">Khối 12</option>
        </select>
        <select 
          value={filterYear} 
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
        >
          <option value="">Tất cả năm học</option>
          {uniqueYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        {(filterYear || filterGrade || searchQuery) && (
          <button 
            onClick={() => { setFilterYear(''); setFilterGrade(''); setSearchQuery(''); }}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 hover:bg-slate-200"
          >
            Xóa lọc
          </button>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Tên lớp</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Khối</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Năm học</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Số học sinh</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length === 0 ? (
                <tr><td colSpan="5" className="py-8 text-center text-sm text-slate-400">Không tìm thấy lớp học nào</td></tr>
              ) : paginatedClasses.map((classItem) => (
                <tr key={classItem.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{classItem.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{classItem.grade}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{classItem.school_year}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {classItem.student_count || 0} học sinh
                  </td>
                  <td className="px-4 py-3 text-right text-sm space-x-2">
                    <button
                      onClick={() => handleOpenStudents(classItem)}
                      className="text-slate-700 hover:text-slate-900"
                    >
                      Danh sách
                    </button>
                    <button
                      onClick={() => handleDownloadStudents(classItem)}
                      className="text-emerald-600 hover:text-emerald-800"
                    >
                      Tải DS
                    </button>
                    <button
                      onClick={() => { setClassForAssign(classItem); setAssignModalOpen(true); }}
                      className="text-violet-600 hover:text-violet-800"
                    >
                      Phân công môn
                    </button>
                    <button
                      onClick={() => handleEdit(classItem)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(classItem.id)}
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
      
      {filteredClasses.length > MAIN_ITEMS_PER_PAGE && (
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

      {studentModalOpen && selectedClass && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black bg-opacity-40 px-4 py-10">
          <div className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Danh sách học sinh - {selectedClass.name}</h3>
                <p className="text-sm text-slate-600">Tải danh sách CSV, cập nhật học sinh hoặc thêm mới trực tiếp.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadStudentCsv(studentList, selectedClass)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
                >
                  Tải CSV
                </button>
                <button
                  onClick={() => setStudentModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-slate-900">Thêm học sinh mới</h4>
                  <p className="text-sm text-slate-600">Thông tin sinh viên sẽ được thêm vào lớp hiện tại.</p>
                </div>
              </div>
              {addStudentError && (
                <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {addStudentError}
                </div>
              )}
              <form onSubmit={handleAddStudent} className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Họ tên</label>
                  <input
                    type="text"
                    value={newStudentForm.full_name}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, full_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={newStudentForm.email}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="student@thpt.edu.vn"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Mật khẩu</label>
                  <input
                    type="text"
                    value={newStudentForm.password}
                    onChange={(e) => setNewStudentForm({ ...newStudentForm, password: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={addStudentLoading}
                    className="inline-flex w-full justify-center rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {addStudentLoading ? 'Đang thêm...' : 'Thêm học sinh'}
                  </button>
                </div>
              </form>
            </div>
            {studentError && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
                {studentError}
              </div>
            )}
            {studentLoading ? (
              <div className="text-center text-slate-600">Đang tải danh sách...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Họ tên</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Lớp hiện tại</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentList.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-6 text-center text-slate-600">Chưa có học sinh trong lớp này.</td>
                      </tr>
                    ) : (
                      studentList.map((student) => (
                        <tr key={student.id} className="border-b border-slate-100">
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {editingStudent?.id === student.id ? (
                              <input
                                type="text"
                                value={studentForm.full_name}
                                onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                              />
                            ) : student.full_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {editingStudent?.id === student.id ? (
                              <input
                                type="email"
                                value={studentForm.email}
                                onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                              />
                            ) : student.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {editingStudent?.id === student.id ? (
                              <select
                                value={studentForm.class_id}
                                onChange={(e) => setStudentForm({ ...studentForm, class_id: e.target.value })}
                                className="w-full rounded-md border border-slate-300 px-3 py-2"
                              >
                                {classes.map((cls) => (
                                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                              </select>
                            ) : selectedClass.name}
                          </td>
                          <td className="px-4 py-3 text-right text-sm space-x-2">
                            {editingStudent?.id === student.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveStudent(student.id)}
                                  className="text-emerald-600 hover:text-emerald-800"
                                >
                                  Lưu
                                </button>
                                <button
                                  onClick={handleCancelEditStudent}
                                  className="text-slate-500 hover:text-slate-700"
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditStudent(student)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleRemoveStudent(student.id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Xóa khỏi lớp
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {editingClass ? 'Sửa lớp học' : 'Thêm lớp học'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tên lớp</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ví dụ: 10A1"
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
                <label className="block text-sm font-medium text-slate-700">Năm học</label>
                <input
                  type="text"
                  value={formData.school_year}
                  onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ví dụ: 2025-2026"
                  required
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
                  {editingClass ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignModalOpen && classForAssign && (
        <ClassSubjectModal
          classItem={classForAssign}
          onClose={() => { setAssignModalOpen(false); setClassForAssign(null); }}
          onSave={() => { setAssignModalOpen(false); setClassForAssign(null); loadClasses(); }}
        />
      )}
    </div>
  );
};

export default ClassManagement;