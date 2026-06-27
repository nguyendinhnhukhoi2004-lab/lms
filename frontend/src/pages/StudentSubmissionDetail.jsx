import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { submissionService } from '../services/api';
import MathViewer from '../components/MathViewer';

const AnswerRow = ({ question, index }) => {
  const { type, content, student_answer, correct_answer, auto_score, final_score, max_score } = question;

  const isCorrect = final_score >= max_score;
  const isPartial = final_score > 0 && final_score < max_score;

  const statusColor = isCorrect
    ? 'border-l-green-400 bg-green-50'
    : isPartial
    ? 'border-l-amber-400 bg-amber-50'
    : 'border-l-red-400 bg-red-50';

  const renderStudentAnswer = () => {
    if (type === 'multiple_choice') {
      return <span className="font-semibold">{student_answer?.selected?.join(', ') || '(Bỏ qua)'}</span>;
    }
    if (type === 'true_false') {
      if (!student_answer?.answers) return <span className="italic text-slate-400">Bỏ qua</span>;
      return (
        <div className="space-y-1">
          {Object.entries(student_answer.answers).map(([id, val]) => (
            <div key={id} className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Mệnh đề {id}:</span>
              <span className={val ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                {val ? 'Đúng' : 'Sai'}
              </span>
              {correct_answer?.answers &&
                (correct_answer.answers[id] === val
                  ? <span className="text-green-500 text-xs">✓</span>
                  : <span className="text-red-500 text-xs">✗</span>
                )
              }
            </div>
          ))}
        </div>
      );
    }
    if (type === 'essay' || type === 'short_answer') {
      return (
        <div className="whitespace-pre-wrap text-sm text-slate-800">
          {student_answer?.text || student_answer?.value || <em className="text-slate-400">Bỏ qua</em>}
        </div>
      );
    }
  };

  const renderCorrectAnswer = () => {
    if (type === 'multiple_choice') {
      return <span className="font-semibold text-green-700">{correct_answer?.selected?.join(', ')}</span>;
    }
    if (type === 'true_false') {
      return (
        <div className="space-y-1">
          {correct_answer?.answers && Object.entries(correct_answer.answers).map(([id, val]) => (
            <div key={id} className="text-sm">
              <span className="text-slate-500">Mệnh đề {id}: </span>
              <span className="text-green-700 font-medium">{val ? 'Đúng' : 'Sai'}</span>
            </div>
          ))}
        </div>
      );
    }
    if (type === 'essay') {
      return <div className="text-sm text-slate-700 whitespace-pre-wrap">{correct_answer?.sample}</div>;
    }
    if (type === 'short_answer') {
      return <span className="text-green-700">{correct_answer?.accepted?.join(' hoặc ')}</span>;
    }
  };

  return (
    <div className={`rounded-xl border-l-4 p-4 ${statusColor}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Câu {index}</span>
        <span className={`text-sm font-bold ${isCorrect ? 'text-green-700' : isPartial ? 'text-amber-700' : 'text-red-700'}`}>
          {final_score ?? auto_score ?? 0} / {max_score} đ
        </span>
      </div>

      <div className="mb-3 text-sm font-medium text-slate-800">
        <MathViewer htmlContent={content} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white p-3">
          <p className="mb-1 text-xs font-semibold text-slate-400">Học sinh trả lời</p>
          {renderStudentAnswer()}
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="mb-1 text-xs font-semibold text-green-600">Đáp án đúng</p>
          {renderCorrectAnswer()}
        </div>
      </div>

      {type === 'essay' && question.similarity_score !== null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${Math.round((question.similarity_score || 0) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            NLP: {Math.round((question.similarity_score || 0) * 100)}% tương đồng
          </span>
        </div>
      )}
    </div>
  );
};

export default function StudentSubmissionDetail() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    submissionService.getResult(submissionId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [submissionId]);

  if (loading) return <div className="py-12 text-center text-slate-400">Đang tải...</div>;
  if (!data) return <div className="py-12 text-center text-red-500">Không tìm thấy bài làm</div>;

  const pct = data.max_score ? Math.round((data.total_score / data.max_score) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <button onClick={() => navigate(-1)} className="text-sm text-brand-600 hover:underline">
        ← Quay lại
      </button>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{data.exam_title}</h2>
        <p className="text-sm text-slate-500">{data.student_name} · {data.class_name}</p>
        <div className="mt-3 flex items-center gap-4">
          <span className="text-3xl font-bold text-slate-900">{data.total_score}</span>
          <span className="text-slate-400">/ {data.max_score} điểm</span>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold
            ${pct >= 80 ? 'bg-green-100 text-green-700'
              : pct >= 50 ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'}`}>
            {pct}%
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {data.answers?.map((q, i) => (
          <AnswerRow key={q.question_id} question={q} index={i + 1} />
        ))}
      </div>
    </div>
  );
}
