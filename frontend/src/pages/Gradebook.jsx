import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { gradeService } from '../services/api';
// We need an api wrapper for get. `api` isn't exported directly like this. 
// Actually I can import `api` from `api.js` if it's exported, but it's not. 
// I'll add `getClasses` to `api.js` or just use fetch. 
// But wait, there is no getClasses in teacherSubjectService. I will add it to api.js later.
// For now let's just use `fetch` with token, or create a quick wrapper.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Gradebook = () => {
  const { user } = useAuth();
  const [homeroomGrades, setHomeroomGrades] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  useEffect(() => {
    // Tìm các lớp mà user này làm GVCN
    const fetchClasses = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_URL}/classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch classes');
        const data = await res.json();
        const classes = data.classes || [];
        const homeroomClasses = classes.filter(c => c.homeroom_teacher_id === user.id);
        setMyClasses(homeroomClasses);
        if (homeroomClasses.length > 0) {
          setSelectedClassId(homeroomClasses[0].id);
        } else {
          setLoading(false);
          setError('Bạn chưa được phân công làm Giáo viên Chủ nhiệm của lớp nào.');
        }
      } catch (err) {
        setError('Lỗi khi tải danh sách lớp');
        setLoading(false);
      }
    };
    fetchClasses();
  }, [user.id]);

  useEffect(() => {
    if (!selectedClassId) return;
    const fetchGrades = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await gradeService.getHomeroomGrades(selectedClassId);
        setHomeroomGrades(data);
      } catch (err) {
        setError(err.message || 'Lỗi khi tải bảng điểm');
      } finally {
        setLoading(false);
      }
    };
    fetchGrades();
  }, [selectedClassId]);

  if (loading && !myClasses.length) return <div className="p-4">Đang tải...</div>;
  if (error && !myClasses.length) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-slate-800">Sổ điểm Lớp chủ nhiệm</h2>
        {myClasses.length > 0 && (
          <div className="mb-6 flex items-center gap-4">
            <label className="text-sm font-medium text-slate-600">Chọn lớp:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="rounded-lg border-slate-300 p-2 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
            >
              {myClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name} - Năm học {c.school_year}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-slate-500">Đang tải dữ liệu điểm...</div>
        ) : error ? (
          <div className="py-10 text-center text-red-500">{error}</div>
        ) : homeroomGrades ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold w-10">STT</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap sticky left-0 bg-slate-50">Họ và tên</th>
                  {homeroomGrades.subjects.map(subject => (
                    <th key={subject} className="px-4 py-3 font-semibold text-center">{subject}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {homeroomGrades.students.map((student, index) => (
                  <tr key={student.student_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-center">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white">{student.full_name}</td>
                    {homeroomGrades.subjects.map(subject => {
                      const subjectScores = student.scores[subject];
                      return (
                        <td key={subject} className="px-4 py-3 text-center">
                          {subjectScores ? (
                            <div className="flex flex-col items-center gap-1">
                              {subjectScores.map((scoreObj, i) => (
                                <span key={i} title={scoreObj.exam_title} className="inline-block rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                                  {scoreObj.score !== null ? Number(scoreObj.score).toFixed(2) : '-'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {homeroomGrades.students.length === 0 && (
                  <tr>
                    <td colSpan={homeroomGrades.subjects.length + 2} className="px-4 py-8 text-center text-slate-500">
                      Chưa có dữ liệu điểm cho lớp này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Gradebook;
