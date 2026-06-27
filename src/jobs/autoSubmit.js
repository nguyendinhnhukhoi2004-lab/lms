// src/jobs/autoSubmit.js
// Job tự động nộp bài + chấm điểm cho các bài thi còn in_progress sau khi lịch kết thúc
// Chạy định kỳ từ server.js

const { query }           = require('../config/db');
const { gradeSubmission } = require('../utils/grader');

const autoSubmitExpiredExams = async () => {
  let expired;

  try {
    const { rows } = await query(`
      SELECT
        sub.id        AS submission_id,
        sub.student_id,
        sub.schedule_id,
        es.exam_id,
        u.full_name   AS student_name,
        e.title       AS exam_title
      FROM submissions sub
      JOIN exam_schedules es ON es.id = sub.schedule_id
      JOIN exams          e  ON e.id  = es.exam_id
      JOIN users          u  ON u.id  = sub.student_id
      WHERE sub.status = 'in_progress'
        AND es.end_time < NOW()
    `);
    expired = rows;
  } catch (err) {
    console.error('[AutoSubmit] Lỗi truy vấn bài quá hạn:', err.message);
    return;
  }

  if (expired.length === 0) return;
  console.log(`[AutoSubmit] Tìm thấy ${expired.length} bài chưa nộp sau giờ thi`);

  for (const sub of expired) {
    try {
      // Bước 1: Đánh dấu submitted — WHERE status='in_progress' tránh race condition
      const { rows: updated } = await query(
        `UPDATE submissions
         SET status = 'submitted', submitted_at = NOW()
         WHERE id = $1 AND status = 'in_progress'
         RETURNING id`,
        [sub.submission_id]
      );

      // Nếu rows trống → bài đã được xử lý trước đó, bỏ qua
      if (updated.length === 0) continue;

      console.log(`[AutoSubmit] Đã nộp bài: ${sub.student_name} — "${sub.exam_title}" (id: ${sub.submission_id})`);

      // Bước 2: Chấm điểm tự động
      try {
        const ExamModel       = require('../models/exam.model');
        const SubmissionModel = require('../models/submission.model');

        const exam = await ExamModel.findById(sub.exam_id);
        if (!exam || !exam.questions?.length) {
          console.warn(`[AutoSubmit] Không lấy được đề thi ${sub.exam_id}, bỏ qua chấm điểm`);
          continue;
        }

        const answers    = await SubmissionModel.findAnswers(sub.submission_id);
        const autoScores = gradeSubmission(exam.questions, answers);

        const normalized = autoScores.map(({ question_id, auto_score }) => ({
          question_id,
          auto_score: parseFloat(Number(auto_score || 0).toFixed(2)),
        }));

        await SubmissionModel.saveAutoScores(sub.submission_id, normalized);

        // Bước 3: Tính tổng điểm và lưu kết quả
        const answersAfter = await SubmissionModel.findAnswers(sub.submission_id);
        const totalScore   = answersAfter.reduce((s, a) => s + Number(a.final_score || 0), 0);
        const maxScore     = exam.questions.reduce((s, q) => s + Number(q.score || 0), 0);

        await SubmissionModel.createResult(
          sub.submission_id,
          sub.student_id,
          sub.exam_id,
          parseFloat(totalScore.toFixed(2)),
          parseFloat(maxScore.toFixed(2))
        );

        console.log(`[AutoSubmit] ✓ Chấm xong: ${sub.student_name} — ${totalScore.toFixed(2)}/${maxScore.toFixed(2)} điểm`);

      } catch (gradeErr) {
        // Lỗi chấm điểm không làm hỏng việc nộp bài đã thành công
        console.error(`[AutoSubmit] Lỗi chấm điểm submission ${sub.submission_id}:`, gradeErr.message);
      }

    } catch (err) {
      // Lỗi 1 bài không dừng các bài khác
      console.error(`[AutoSubmit] Lỗi xử lý submission ${sub.submission_id}:`, err.message);
    }
  }
};

module.exports = { autoSubmitExpiredExams };
