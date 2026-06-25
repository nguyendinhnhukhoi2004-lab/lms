// controllers/statistics.controller.js
// Xử lý tất cả API thống kê và báo cáo
// Mỗi endpoint phục vụ 1 đối tượng cụ thể: học sinh / giáo viên / admin

const StatsModel = require('../models/statistics.model');

// ============================================================
// THỐNG KÊ KỲ THI — Giáo viên xem kết quả 1 lịch thi
// ============================================================

// GET /api/statistics/schedule/:scheduleId
// Trả về TẤT CẢ: summary, phân bổ điểm, danh sách kết quả học sinh
const getScheduleSummary = async (req, res) => {
  try {
    const sid = req.params.scheduleId;
    const [rawSummary, distribution, results] = await Promise.all([
      StatsModel.getScheduleSummary(sid),
      StatsModel.getScoreDistribution(sid),
      StatsModel.getScheduleResults(sid),
    ]);

    // Tính pass_rate và reshape score_distribution cho frontend
    const total = rawSummary?.total_students || 0;
    const passCount = results.filter(r => (r.total_score / r.max_score) >= 0.5).length;

    const summary = {
      ...rawSummary,
      submitted:   rawSummary?.submitted_count || 0,
      pass_rate:   total ? Math.round((passCount / total) * 100) : 0,
      score_distribution: {
        excellent:  distribution?.gioi_xuat_sac || 0,
        good:       distribution?.gioi || 0,
        above_avg:  distribution?.kha || 0,
        avg:        distribution?.trung_binh || 0,
        poor:       distribution?.kem || 0,
      },
      results,
    };

    return res.status(200).json(summary);
  } catch (err) {
    console.error('getScheduleSummary error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/statistics/schedule/:scheduleId/distribution
// Phân bổ điểm: Kém / Trung bình / Khá / Giỏi / Xuất sắc
const getScoreDistribution = async (req, res) => {
  try {
    const distribution = await StatsModel.getScoreDistribution(req.params.scheduleId);
    return res.status(200).json({ distribution });
  } catch (err) {
    console.error('getScoreDistribution error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/statistics/schedule/:scheduleId/questions
// Phân tích từng câu hỏi: tỉ lệ đúng, điểm TB
// Dùng để phát hiện câu quá khó / quá dễ
const getQuestionAnalysis = async (req, res) => {
  try {
    const questions = await StatsModel.getQuestionAnalysis(req.params.scheduleId);
    return res.status(200).json({ questions });
  } catch (err) {
    console.error('getQuestionAnalysis error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/statistics/schedule/:scheduleId/full
// Trả về TẤT CẢ thống kê của 1 kỳ thi trong 1 request
// Dùng cho trang báo cáo chi tiết của giáo viên
const getScheduleFull = async (req, res) => {
  try {
    const [summary, distribution, questions] = await Promise.all([
      StatsModel.getScheduleSummary(req.params.scheduleId),
      StatsModel.getScoreDistribution(req.params.scheduleId),
      StatsModel.getQuestionAnalysis(req.params.scheduleId),
    ]);
    return res.status(200).json({ summary, distribution, questions });
  } catch (err) {
    console.error('getScheduleFull error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// THỐNG KÊ LỚP — Giáo viên / tổ trưởng xem lịch sử lớp
// ============================================================

// GET /api/statistics/class/:classId
// Lịch sử tất cả kỳ thi của 1 lớp + điểm TB từng kỳ
const getClassHistory = async (req, res) => {
  try {
    // Giáo viên chỉ được xem lớp có liên quan — admin/tổ trưởng xem tất cả
    // (Có thể thêm kiểm tra quyền chi tiết hơn nếu cần)
    const history = await StatsModel.getClassHistory(req.params.classId);
    return res.status(200).json({ history });
  } catch (err) {
    console.error('getClassHistory error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// THỐNG KÊ HỌC SINH — Học sinh xem tiến độ bản thân
// ============================================================

// GET /api/statistics/my-progress
// Biểu đồ đường điểm qua từng bài thi, nhóm theo môn học
const getMyProgress = async (req, res) => {
  try {
    const progress = await StatsModel.getStudentProgress(req.user.id);
    return res.status(200).json({ progress });
  } catch (err) {
    console.error('getMyProgress error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/statistics/my-summary (học sinh tự xem tóm tắt theo môn)
const getMySummary = async (req, res) => {
  try {
    const [subjectRows, progressGrouped] = await Promise.all([
      StatsModel.getStudentSummary(req.user.id),
      StatsModel.getStudentProgress(req.user.id),
    ]);
    // Flatten grouped object thành array phẳng, sắp xếp theo thời gian
    const recentResults = Object.values(progressGrouped || {})
      .flat()
      .sort((a, b) => new Date(b.graded_at) - new Date(a.graded_at))
      .slice(0, 10);

    // Tổng hợp thêm các chỉ số tổng để Dashboard dùng
    const totalExams = subjectRows.reduce((s, r) => s + r.exam_count, 0);
    const avgScore   = subjectRows.length
      ? subjectRows.reduce((s, r) => s + parseFloat(r.avg_score_on_10 || 0), 0) / subjectRows.length
      : null;
    const bestScore  = subjectRows.length
      ? Math.max(...subjectRows.map(r => parseFloat(r.best_score_on_10 || 0)))
      : null;

    return res.status(200).json({
      total_exams:     totalExams,
      avg_score:       avgScore ? parseFloat(avgScore.toFixed(2)) : null,
      max_possible:    10,
      best_score:      bestScore,
      pending_manual:  0,    // TODO: đếm bài thi có câu tự luận chưa chấm
      by_subject:      subjectRows,
      recent_results:  recentResults || [],
    });
  } catch (err) {
    console.error('getMySummary error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/statistics/student/:studentId/progress
// Giáo viên / admin xem tiến độ của 1 học sinh cụ thể
const getStudentProgress = async (req, res) => {
  try {
    const [progress, summary] = await Promise.all([
      StatsModel.getStudentProgress(req.params.studentId),
      StatsModel.getStudentSummary(req.params.studentId),
    ]);
    return res.status(200).json({ progress, summary });
  } catch (err) {
    console.error('getStudentProgress error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// TỔNG QUAN TOÀN TRƯỜNG — Admin dashboard
// ============================================================

// GET /api/statistics/overview
// Số liệu tổng: học sinh, giáo viên, câu hỏi, đề thi, bài nộp...
const getSchoolOverview = async (req, res) => {
  try {
    const overview = await StatsModel.getSchoolOverview();
    return res.status(200).json({ overview });
  } catch (err) {
    console.error('getSchoolOverview error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/statistics/question-bank
// Phân bổ ngân hàng câu hỏi: by_type, my_questions, approved_questions
const getQuestionBankStats = async (req, res) => {
  try {
    // Trả về stats theo teacher_id để Dashboard giáo viên dùng được
    const stats = await StatsModel.getQuestionBankStatsByTeacher(req.user.id);
    return res.status(200).json(stats);
  } catch (err) {
    console.error('getQuestionBankStats error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = {
  getScheduleSummary,
  getScoreDistribution,
  getQuestionAnalysis,
  getScheduleFull,
  getClassHistory,
  getMyProgress,
  getMySummary,
  getStudentProgress,
  getSchoolOverview,
  getQuestionBankStats,
};
