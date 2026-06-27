// models/statistics.model.js
// Các query thống kê — JOIN nhiều bảng, dùng aggregate functions của PostgreSQL

const { query } = require('../config/db');

// ============================================================
// THỐNG KÊ THEO KỲ THI (cho giáo viên xem 1 đề thi cụ thể)
// ============================================================

/**
 * Thống kê tổng quan 1 kỳ thi (1 lịch thi)
 * Trả về: tổng số học sinh, số đã nộp, điểm TB, điểm cao nhất, thấp nhất, độ lệch chuẩn
 */
const getScheduleSummary = async (schedule_id) => {
  const { rows } = await query(
    `SELECT
       COUNT(sub.id)::int                          AS total_students,
       COUNT(CASE WHEN sub.status != 'in_progress' THEN 1 END)::int AS submitted_count,
       COUNT(CASE WHEN sub.status = 'in_progress'  THEN 1 END)::int AS not_submitted_count,
       ROUND(AVG(r.total_score)::numeric, 2)       AS avg_score,
       MAX(r.total_score)                          AS max_score_achieved,
       MIN(r.total_score)                          AS min_score_achieved,
       ROUND(STDDEV(r.total_score)::numeric, 2)   AS std_deviation,
       -- Điểm tối đa của đề (lấy từ bản ghi đầu tiên)
       MAX(r.max_score)                            AS exam_max_score
     FROM submissions sub
     LEFT JOIN results r ON r.submission_id = sub.id
     WHERE sub.schedule_id = $1`,
    [schedule_id]
  );
  return rows[0];
};

/**
 * Phân bổ điểm theo thang: < 5, 5–6.4, 6.5–7.9, 8–9, 9–10
 * Dùng để vẽ biểu đồ cột phân bổ điểm
 */
const getScoreDistribution = async (schedule_id) => {
  const { rows } = await query(
    `SELECT
       -- Tính % so với điểm tối đa để so sánh được dù thang điểm khác nhau
       SUM(CASE WHEN (r.total_score / r.max_score) * 10 < 5            THEN 1 ELSE 0 END)::int AS kem,
       SUM(CASE WHEN (r.total_score / r.max_score) * 10 BETWEEN 5 AND 6.4  THEN 1 ELSE 0 END)::int AS trung_binh,
       SUM(CASE WHEN (r.total_score / r.max_score) * 10 BETWEEN 6.5 AND 7.9 THEN 1 ELSE 0 END)::int AS kha,
       SUM(CASE WHEN (r.total_score / r.max_score) * 10 BETWEEN 8 AND 8.9   THEN 1 ELSE 0 END)::int AS gioi,
       SUM(CASE WHEN (r.total_score / r.max_score) * 10 >= 9            THEN 1 ELSE 0 END)::int AS xuat_sac,
       COUNT(r.id)::int AS total
     FROM submissions sub
     JOIN results r ON r.submission_id = sub.id
     WHERE sub.schedule_id = $1`,
    [schedule_id]
  );
  return rows[0];
};

/**
 * Thống kê từng câu hỏi trong đề:
 * - Tỉ lệ trả lời đúng (cho trắc nghiệm)
 * - Điểm trung bình (cho tự luận)
 * Dùng để phát hiện câu hỏi quá khó hoặc quá dễ
 */
const getQuestionAnalysis = async (schedule_id) => {
  const { rows } = await query(
    `SELECT
       q.id          AS question_id,
       q.content     AS question_content,
       q.type,
       q.difficulty,
       eq.score      AS max_score,
       COUNT(sa.id)::int                           AS answer_count,
       ROUND(AVG(sa.final_score)::numeric, 2)      AS avg_score,
       -- Tỉ lệ đạt full điểm (proxy cho "trả lời đúng")
       ROUND(
         (SUM(CASE WHEN sa.final_score = eq.score THEN 1 ELSE 0 END)::numeric
          / NULLIF(COUNT(sa.id), 0)) * 100, 1
       )                                            AS correct_rate_pct,
       ROUND(AVG(sa.similarity_score)::numeric, 4) AS avg_similarity
     FROM exam_schedules es
     JOIN exam_questions eq ON eq.exam_id = es.exam_id
     JOIN questions      q  ON q.id = eq.question_id
     LEFT JOIN submissions   sub ON sub.schedule_id = es.id
     LEFT JOIN submission_answers sa
       ON sa.submission_id = sub.id AND sa.question_id = q.id
     WHERE es.id = $1
     GROUP BY q.id, q.content, q.type, q.difficulty, eq.score
     ORDER BY eq.order_index`,
    [schedule_id]
  );
  return rows;
};

// ============================================================
// THỐNG KÊ THEO LỚP (cho giáo viên chủ nhiệm / tổ trưởng)
// ============================================================

/**
 * Kết quả tất cả kỳ thi của 1 lớp, sắp xếp theo thời gian
 */
const getClassHistory = async (class_id) => {
  const { rows } = await query(
    `SELECT
       es.id   AS schedule_id,
       es.start_time,
       e.title AS exam_title,
       s.name  AS subject_name,
       s.grade,
       COUNT(sub.id)::int                         AS total_students,
       ROUND(AVG(r.total_score)::numeric, 2)      AS avg_score,
       MAX(r.max_score)                            AS exam_max_score
     FROM exam_schedules es
     JOIN exams    e   ON es.exam_id  = e.id
     JOIN subjects s   ON e.subject_id = s.id
     LEFT JOIN submissions sub ON sub.schedule_id = es.id
     LEFT JOIN results     r   ON r.submission_id = sub.id
     WHERE es.class_id = $1
     GROUP BY es.id, es.start_time, e.title, s.name, s.grade
     ORDER BY es.start_time DESC`,
    [class_id]
  );
  return rows;
};

// ============================================================
// THỐNG KÊ THEO HỌC SINH (cho học sinh xem tiến độ bản thân)
// ============================================================

/**
 * Lịch sử điểm của học sinh theo từng môn
 * Dùng để vẽ biểu đồ đường tiến độ học tập
 */
const getStudentProgress = async (student_id) => {
  const { rows } = await query(
    `SELECT
       r.graded_at,
       e.title     AS exam_title,
       s.name      AS subject_name,
       s.grade,
       r.total_score,
       r.max_score,
       ROUND((r.total_score / r.max_score * 10)::numeric, 2) AS score_on_10
     FROM results r
     JOIN exams    e ON r.exam_id     = e.id
     JOIN subjects s ON e.subject_id  = s.id
     WHERE r.student_id = $1
     ORDER BY s.name, r.graded_at ASC`,
    [student_id]
  );

  // Nhóm theo môn học để dễ vẽ biểu đồ đường từng môn
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.subject_name]) grouped[row.subject_name] = [];
    grouped[row.subject_name].push(row);
  }
  return grouped;
};

/**
 * Thống kê tóm tắt của học sinh: điểm TB từng môn, số bài đã thi
 */
const getStudentSummary = async (student_id) => {
  const { rows } = await query(
    `SELECT
       s.name                                        AS subject_name,
       COUNT(r.id)::int                              AS exam_count,
       ROUND(AVG(r.total_score / r.max_score * 10)::numeric, 2) AS avg_score_on_10,
       MAX(r.total_score / r.max_score * 10)         AS best_score_on_10,
       MIN(r.total_score / r.max_score * 10)         AS lowest_score_on_10
     FROM results r
     JOIN exams    e ON r.exam_id    = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE r.student_id = $1
     GROUP BY s.name
     ORDER BY s.name`,
    [student_id]
  );
  return rows;
};

// ============================================================
// THỐNG KÊ TỔNG QUAN TOÀN TRƯỜNG (cho admin)
// ============================================================

/**
 * Dashboard admin: số liệu tổng của toàn trường
 */
const getSchoolOverview = async () => {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = TRUE)::int AS total_students,
       (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = TRUE)::int AS total_teachers,
       (SELECT COUNT(*) FROM classes)::int                                            AS total_classes,
       (SELECT COUNT(*) FROM questions WHERE is_approved = TRUE)::int                AS approved_questions,
       (SELECT COUNT(*) FROM questions WHERE is_approved = FALSE)::int               AS pending_questions,
       (SELECT COUNT(*) FROM exams WHERE status = 'approved')::int                   AS approved_exams,
       (SELECT COUNT(*) FROM submissions WHERE status != 'in_progress')::int         AS total_submissions,
       (SELECT COUNT(*) FROM exam_schedules WHERE is_active = TRUE
          AND NOW() BETWEEN start_time AND end_time)::int                            AS active_exams_now`
  );
  return rows[0];
};

/**
 * Thống kê ngân hàng câu hỏi: số câu theo môn, dạng, mức độ
 */
const getQuestionBankStats = async () => {
  const { rows } = await query(
    `SELECT
       s.name      AS subject_name,
       s.grade,
       q.type,
       q.difficulty,
       COUNT(*)::int AS count
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     WHERE q.is_approved = TRUE
     GROUP BY s.name, s.grade, q.type, q.difficulty
     ORDER BY s.grade, s.name, q.type, q.difficulty`
  );
  return rows;
};

/**
 * Danh sách kết quả từng học sinh trong 1 lịch thi
 * Dùng cho bảng xếp hạng của giáo viên
 */
const getScheduleResults = async (schedule_id) => {
  const { rows } = await query(
    `SELECT
       r.id,
       u.full_name   AS student_name,
       c.name        AS class_name,
       r.total_score,
       r.max_score,
       sub.status,
       sub.submitted_at
     FROM submissions sub
     JOIN results r ON r.submission_id = sub.id
     JOIN users   u ON sub.student_id  = u.id
     LEFT JOIN classes c ON u.class_id = c.id
     WHERE sub.schedule_id = $1
       AND sub.status != 'in_progress'
     ORDER BY r.total_score DESC`,
    [schedule_id]
  );
  return rows;
};

/**
 * Thống kê ngân hàng câu hỏi tổng hợp (theo teacher_id nếu truyền vào)
 */
const getQuestionBankStatsByTeacher = async (teacher_id) => {
  const { rows } = await query(
    `SELECT
       COUNT(*)::int                                                       AS total,
       COUNT(CASE WHEN is_approved = TRUE  THEN 1 END)::int               AS approved_questions,
       COUNT(CASE WHEN is_approved = FALSE THEN 1 END)::int               AS pending_questions,
       COUNT(CASE WHEN created_by = $1     THEN 1 END)::int               AS my_questions,
       COUNT(CASE WHEN type = 'multiple_choice' THEN 1 END)::int          AS mc_count,
       COUNT(CASE WHEN type = 'true_false'      THEN 1 END)::int          AS tf_count,
       COUNT(CASE WHEN type = 'essay'           THEN 1 END)::int          AS essay_count
     FROM questions`,
    [teacher_id]
  );
  return {
    ...rows[0],
    by_type: {
      multiple_choice: rows[0].mc_count,
      true_false:      rows[0].tf_count,
      essay:           rows[0].essay_count,
    },
  };
};

const getPendingManualCount = async (student_id) => {
  const { rows } = await query(
    `SELECT COUNT(DISTINCT sub.id) AS pending_count
     FROM submissions sub
     JOIN submission_answers sa ON sa.submission_id = sub.id
     JOIN questions q ON q.id = sa.question_id
     WHERE sub.student_id = $1
       AND sub.status = 'submitted'
       AND q.type = 'essay'
       AND (sa.similarity_score = -1 OR sa.final_score IS NULL)`,
    [student_id]
  );
  return parseInt(rows[0]?.pending_count || 0, 10);
};

module.exports = {
  getScheduleSummary,
  getPendingManualCount,
  getScoreDistribution,
  getQuestionAnalysis,
  getClassHistory,
  getStudentProgress,
  getStudentSummary,
  getSchoolOverview,
  getQuestionBankStats,
  getScheduleResults,
  getQuestionBankStatsByTeacher,
};
