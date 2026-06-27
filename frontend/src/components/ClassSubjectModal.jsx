import React, { useState, useEffect } from 'react';
import { classSubjectService, subjectService, userService, teacherSubjectService } from '../services/api';

const ClassSubjectModal = ({ classItem, onClose, onSave }) => {
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Load all subjects and teachers concurrently
        const [allSubjects, allUsers, currentAssignments, ts] = await Promise.all([
          subjectService.getAll(),
          userService.getAll(),
          classSubjectService.getByClass(classItem.id),
          teacherSubjectService.getAll()
        ]);
        
        setTeacherSubjects(ts.assignments || ts || []);

        // Only teachers and department heads can teach
        const userList = allUsers.users || allUsers || [];
        const eligibleTeachers = userList.filter(u => u.role === 'teacher' || u.role === 'department_head');
        setTeachers(eligibleTeachers);

        // Sort subjects by grade then name and filter by class grade
        const sortedSubjects = allSubjects
          .filter(s => s.grade === classItem.grade)
          .sort((a, b) => {
            if (a.grade !== b.grade) return a.grade - b.grade;
            return a.name.localeCompare(b.name);
          });
        setSubjects(sortedSubjects);

        // Prepare assignments state
        // It's a map of subject_id -> teacher_id
        const assignMap = {};
        currentAssignments.forEach(a => {
          assignMap[a.subject_id] = a.teacher_id;
        });

        // Initialize state with existing assignments or empty
        const initialAssignments = sortedSubjects.map(s => ({
          subject_id: s.id,
          subject_name: s.name,
          grade: s.grade,
          teacher_id: assignMap[s.id] || ''
        }));
        setAssignments(initialAssignments);

      } catch (err) {
        setError('Không thể tải dữ liệu phân công');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (classItem) {
      fetchData();
    }
  }, [classItem]);

  const handleTeacherChange = (subjectId, teacherId) => {
    setAssignments(prev => prev.map(a => 
      a.subject_id === subjectId ? { ...a, teacher_id: teacherId } : a
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Filter out unassigned subjects
      const payload = assignments
        .filter(a => a.teacher_id)
        .map(a => ({
          subject_id: a.subject_id,
          teacher_id: a.teacher_id
        }));

      await classSubjectService.assignToClass(classItem.id, payload);
      onSave();
    } catch (err) {
      setError('Lỗi khi lưu phân công môn học');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Phân công giảng dạy
            </h2>
            <p className="text-sm text-slate-500">Lớp: {classItem.name} - Khối {classItem.grade}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 mb-4"></div>
              Đang tải danh sách môn học...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Môn học</th>
                      <th className="px-4 py-3 font-semibold">Khối</th>
                      <th className="px-4 py-3 font-semibold">Giáo viên phụ trách</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.map(a => (
                      <tr key={a.subject_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">{a.subject_name}</td>
                        <td className="px-4 py-3">{a.grade}</td>
                        <td className="px-4 py-3">
                          <select
                            value={a.teacher_id}
                            onChange={(e) => handleTeacherChange(a.subject_id, e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="">-- Chưa phân công --</option>
                            {teachers.filter(t => 
                              teacherSubjects.some(ts => ts.teacher_id === t.id && ts.subject_id === a.subject_id)
                            ).map(t => (
                              <option key={t.id} value={t.id}>{t.full_name} ({t.email})</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            disabled={saving}
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Đang lưu...' : 'Lưu phân công'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassSubjectModal;
