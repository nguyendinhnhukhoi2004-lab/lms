import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { submissionService } from '../services/api';
import MathViewer from '../components/MathViewer';

const TYPE_LABELS = {
  multiple_choice: 'Trắc nghiệm',
  true_false: 'Đúng/Sai',
  essay: 'Tự luận'
};

const TYPE_COLORS = {
  multiple_choice: 'bg-blue-100 text-blue-700',
  true_false: 'bg-violet-100 text-violet-700',
  essay: 'bg-orange-100 text-orange-700'
};

const StudentSubmissionView = () => {
  const { id } = useParams(); // submissionId
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await submissionService.getResult(id);
        setData(res);
      } catch (err) {
        setError(err.message || 'Không thể tải bài làm');
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [id]);

  if (loading) return <div className="p-10 text-center text-slate-500">Đang tải...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;
  if (!data) return null;

  const { result, answers } = data;

  const renderQuestionDetail = (a, index) => {
    const qType = a.question_type;
    const isCorrect = a.auto_score > 0 || a.final_score > 0;
    const scoreColor = isCorrect ? 'text-emerald-600' : 'text-red-500';

    return (
      <div key={a.question_id} className="mb-6 rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-900 text-lg">Câu {index + 1}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[qType] || 'bg-slate-100 text-slate-600'}`}>
                {TYPE_LABELS[qType] || 'Khác'}
              </span>
            </div>
            <span className={`font-semibold text-sm ${scoreColor}`}>
              Điểm: {a.final_score ?? a.auto_score ?? 0} / {a.max_score}
            </span>
          </div>
        </div>

        {/* Nội dung câu hỏi */}
        <div className="mb-6 text-slate-800 text-[15px]">
          <MathViewer htmlContent={a.question_content} />
        </div>

        {/* Render câu trả lời theo từng loại */}
        {qType === 'multiple_choice' && (
          <div className="space-y-2 mb-4">
            {(a.options || []).map((opt, i) => {
              const optId = opt.id || String.fromCharCode(65 + i); // A, B, C, D
              const isSelected = a.student_answer?.selected?.includes(optId);
              const isActualCorrect = a.correct_answer?.correct?.includes(optId);

              let boxClass = "rounded-xl border p-3 flex gap-3 items-start ";
              if (isSelected && isActualCorrect) {
                boxClass += "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300";
              } else if (isSelected && !isActualCorrect) {
                boxClass += "bg-red-50 border-red-300 ring-1 ring-red-300";
              } else if (!isSelected && isActualCorrect) {
                boxClass += "bg-emerald-50/50 border-emerald-300 border-dashed";
              } else {
                boxClass += "bg-slate-50 border-slate-200 opacity-60";
              }

              return (
                <div key={optId} className={boxClass}>
                  <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold
                    ${(isSelected || isActualCorrect) ? (isActualCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-white border-2 border-slate-300 text-slate-500'}`}>
                    {optId}
                  </div>
                  <div className={`text-sm ${(isSelected || isActualCorrect) ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                    <MathViewer htmlContent={opt.text} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {qType === 'true_false' && (
          <div className="space-y-2 mb-4">
            {/* Giả định format statements nếu API trả về trong options, backend hiện tại chỉ có question_content */}
            {/* Để đơn giản, chỉ hiện kết quả TS học sinh chọn vs đáp án đúng */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Học sinh chọn:</p>
                {a.student_answer?.answers ? (
                  <ul className="space-y-1">
                    {Object.entries(a.student_answer.answers).map(([k, v]) => (
                      <li key={k} className="text-sm">
                        <span className="font-bold mr-1">{k}:</span> {v ? 'Đúng' : 'Sai'}
                      </li>
                    ))}
                  </ul>
                ) : <span className="text-slate-400 italic text-sm">Bỏ trống</span>}
              </div>
              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200">
                <p className="text-xs font-semibold text-emerald-700 uppercase mb-2">Đáp án chuẩn:</p>
                {a.correct_answer?.answers ? (
                  <ul className="space-y-1">
                    {Object.entries(a.correct_answer.answers).map(([k, v]) => (
                      <li key={k} className="text-sm text-emerald-800">
                        <span className="font-bold mr-1">{k}:</span> {v ? 'Đúng' : 'Sai'}
                      </li>
                    ))}
                  </ul>
                ) : <span className="text-emerald-600/50 italic text-sm">Chưa rõ đáp án</span>}
              </div>
            </div>
          </div>
        )}

        {qType === 'essay' && (
          <div className="space-y-4 mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bài làm của học sinh:</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-800 min-h-[60px]">
                {a.student_answer?.text || <span className="text-slate-400 italic">Bỏ trống</span>}
              </div>
            </div>
            
            {(a.sample_answer || (a.correct_answer && a.correct_answer.keywords)) && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700 uppercase mb-1">Đáp án mẫu / Từ khóa:</p>
                {a.sample_answer && (
                  <div className="text-sm text-emerald-900 whitespace-pre-wrap mb-2">
                    <MathViewer htmlContent={a.sample_answer} />
                  </div>
                )}
                {a.correct_answer?.keywords && a.correct_answer.keywords.length > 0 && (
                  <p className="text-xs text-emerald-800 mt-2 border-t border-emerald-200/50 pt-2">
                    <span className="font-semibold">Từ khóa kỳ vọng:</span> {a.correct_answer.keywords.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lời giải chi tiết (nếu có) */}
        {a.correct_answer?.explanation && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Giải thích đáp án:</p>
            <div className="text-sm text-blue-900 whitespace-pre-wrap">
              <MathViewer htmlContent={a.correct_answer.explanation} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Header Back */}
      <div className="flex items-center justify-between">
        <button onClick={() => window.history.back()} className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Quay lại
        </button>
      </div>

      {/* Thông tin tổng quan */}
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Chi tiết bài làm</h2>
          <div className="space-y-1 text-sm text-slate-600">
            <p><span className="font-medium text-slate-800">Thời gian làm bài:</span> {new Date(result.graded_at || result.created_at || Date.now()).toLocaleString('vi-VN')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng điểm</p>
            <p className="text-4xl font-extrabold text-brand-600">
              {result.total_score} <span className="text-lg text-slate-400 font-medium">/ {result.max_score}</span>
            </p>
          </div>
          <div className="h-12 w-px bg-slate-200"></div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Đánh giá</p>
            <p className={`text-lg font-bold ${
              (result.total_score / result.max_score) >= 0.8 ? 'text-emerald-600' :
              (result.total_score / result.max_score) >= 0.5 ? 'text-amber-500' : 'text-red-500'
            }`}>
              {(result.total_score / result.max_score) >= 0.8 ? 'Tốt' :
               (result.total_score / result.max_score) >= 0.5 ? 'Đạt' : 'Chưa đạt'}
            </p>
          </div>
        </div>
      </div>

      {/* Chi tiết từng câu */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 px-2">Chi tiết từng câu hỏi ({answers.length} câu)</h3>
        <div className="space-y-2">
          {answers.map((a, idx) => renderQuestionDetail(a, idx))}
        </div>
      </div>
    </div>
  );
};

export default StudentSubmissionView;
