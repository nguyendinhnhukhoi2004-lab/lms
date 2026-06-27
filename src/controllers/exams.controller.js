// controllers/exams.controller.js
// Xử lý toàn bộ nghiệp vụ đề thi:
//   - Tạo đề thủ công (chọn từng câu)
//   - Tạo đề tự động (theo cấu trúc phân bổ mức độ)
//   - Luồng phê duyệt đề
//   - Lên lịch thi cho lớp

const { validationResult } = require('express-validator');
const xlsx = require('xlsx');
const ExamModel           = require('../models/exam.model');
const TeacherSubjectModel = require('../models/teacher_subject.model');
const QuestionModel = require('../models/question.model');
const ExamRoomsModel = require('../models/exam_rooms.model');

// ============================================================
// EXAMS — CRUD & LUỒNG PHÊ DUYỆT
// ============================================================

// GET /api/exams
const VALID_STATUSES = ['draft', 'pending_approval', 'approved', 'archived', 'rejected'];

const getAll = async (req, res) => {
  try {
    const { subject_id, page = 1, limit = 20 } = req.query;

    // Validate status nếu có truyền vào — tránh PostgreSQL enum error
    let status = req.query.status;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Trạng thái không hợp lệ. Hợp lệ: ${VALID_STATUSES.join(', ')}` });
    }

    // Giáo viên chỉ thấy đề của mình + trong môn được phân công
    const created_by = req.user.role === 'teacher' ? req.user.id : req.query.created_by;

    let subject_ids   = undefined;
    let subject_names = undefined;

    if (req.user.role === 'teacher') {
      const assigned = await TeacherSubjectModel.findSubjectIdsByTeacher(req.user.id);
      if (assigned.length === 0) return res.status(200).json({ exams: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      subject_ids = assigned;
    } else if (req.user.role === 'department_head') {
      const assigned = await TeacherSubjectModel.findSubjectIdsByTeacher(req.user.id);
      const headSubjects = await TeacherSubjectModel.findSubjectNamesByHead(req.user.id);
      
      if (headSubjects.length === 0 && assigned.length === 0) {
        return res.status(200).json({ exams: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      }
      
      if (assigned.length > 0) subject_ids = assigned;
      if (headSubjects.length > 0) subject_names = headSubjects;
    }

    const result = await ExamModel.findAll({
      subject_id,
      status: status || undefined,
      created_by,
      subject_ids,
      subject_names,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('getAll exams error:', err.message);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/exams/:id
const getById = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
    }

    // Giáo viên chỉ xem đề của mình hoặc đề đã duyệt
    if (req.user.role === 'teacher'
      && exam.created_by !== req.user.id
      && exam.status !== 'approved') {
      return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
    }

    return res.status(200).json({ exam });
  } catch (err) {
    console.error('getById exam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/exams
// Tạo đề thi mới (bản nháp, chưa có câu hỏi)
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, subject_id, duration_minutes, description } = req.body;

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền tạo đề thi cho môn học này' });
    }

    const exam = await ExamModel.create({
      title, subject_id,
      created_by: req.user.id,
      duration_minutes,
      description,
    });
    return res.status(201).json({ message: 'Tạo đề thi thành công', exam });
  } catch (err) {
    console.error('create exam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/exams/:id
// Body: { title, subject_id, duration_minutes, description }
const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, subject_id, duration_minutes, description } = req.body;
    const exam = await ExamModel.findById(req.params.id);
    
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });
    if (exam.status !== 'draft') return res.status(409).json({ message: 'Chỉ có thể sửa đề đang ở trạng thái bản nháp' });
    if (req.user.role === 'teacher' && exam.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đề thi này' });
    }
    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền gán đề thi cho môn học này' });
    }

    const updated = await ExamModel.updateInfo(req.params.id, {
      title, subject_id, duration_minutes, description
    });

    return res.status(200).json({ message: 'Cập nhật đề thi thành công', exam: updated });
  } catch (err) {
    console.error('update exam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/exams/:id/questions
// Thêm/cập nhật danh sách câu hỏi vào đề — chọn thủ công
// Body: { questions: [{question_id, score}, ...] }
const setQuestions = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    if (req.user.role === 'teacher' && exam.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đề thi này' });
    }
    if (exam.status !== 'draft') {
      return res.status(409).json({ message: 'Chỉ có thể chỉnh sửa đề đang ở trạng thái bản nháp' });
    }

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Danh sách câu hỏi không được để trống' });
    }

    // Kiểm tra tất cả câu hỏi phải đã được phê duyệt và thuộc đúng môn
    for (const q of questions) {
      const found = await QuestionModel.findById(q.question_id);
      if (!found) {
        return res.status(404).json({ message: `Câu hỏi ${q.question_id} không tồn tại` });
      }
      if (!found.is_approved) {
        return res.status(409).json({ message: `Câu hỏi "${found.content.slice(0, 40)}..." chưa được phê duyệt` });
      }
      if (found.subject_id !== exam.subject_id) {
        return res.status(409).json({ message: `Câu hỏi "${found.content.slice(0, 40)}..." không thuộc môn của đề thi` });
      }
      if (!q.score || q.score <= 0) {
        return res.status(400).json({ message: `Câu hỏi ${q.question_id} phải có điểm > 0` });
      }
    }

    const updated = await ExamModel.addQuestions(req.params.id, questions);
    return res.status(200).json({ message: 'Cập nhật câu hỏi thành công', exam: updated });
  } catch (err) {
    console.error('setQuestions error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/exams/:id/auto-generate
// Tạo đề tự động theo cấu trúc phân bổ mức độ (CV 7991: 3 mức Biết/Hiểu/Vận dụng)
// Body: {
//   structure: [
//     { type: "multiple_choice", difficulty: "nhan_biet",  count: 6, score: 0.25 },
//     { type: "multiple_choice", difficulty: "thong_hieu", count: 4, score: 0.25 },
//     { type: "true_false",      difficulty: "van_dung",   count: 2, score: 1.00 },
//     { type: "essay",           difficulty: "van_dung",   count: 1, score: 2.00 },
//   ]
// }
const autoGenerate = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    if (exam.status !== 'draft') {
      return res.status(409).json({ message: 'Chỉ có thể tạo đề ở trạng thái bản nháp' });
    }

    const { structure } = req.body;
    if (!Array.isArray(structure) || structure.length === 0) {
      return res.status(400).json({ message: 'Cần cung cấp cấu trúc đề (structure)' });
    }

    const selectedQuestions = []; // [{question_id, score}]
    const usedIds = [];           // tránh trùng câu

    // Lấy ngẫu nhiên câu hỏi cho từng nhóm trong cấu trúc
    for (const group of structure) {
      const { type, difficulty, count, score } = group;

      if (!count || !score) {
        return res.status(400).json({
          message: 'Mỗi nhóm cần có count (số câu) và score (điểm mỗi câu)',
        });
      }

      const found = await QuestionModel.findRandom({
        subject_id:  exam.subject_id,
        type,
        difficulty,
        exclude_ids: usedIds,
        limit:       count,
      });

      if (found.length < count) {
        return res.status(409).json({
          message: `Không đủ câu hỏi ${type} mức ${difficulty} (cần ${count}, có ${found.length})`,
        });
      }

      found.forEach(q => {
        selectedQuestions.push({ question_id: q.id, score });
        usedIds.push(q.id);
      });
    }

    // Lưu danh sách câu hỏi vào đề
    const updated = await ExamModel.addQuestions(req.params.id, selectedQuestions);
    return res.status(200).json({
      message: `Đã tạo tự động ${selectedQuestions.length} câu hỏi`,
      exam: updated,
    });
  } catch (err) {
    console.error('autoGenerate error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/exams/:id/submit
// Giáo viên gửi đề lên tổ trưởng
const submit = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    if (req.user.role === 'teacher' && exam.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền gửi đề thi này' });
    }
    if (!exam.questions || exam.questions.length === 0) {
      return res.status(409).json({ message: 'Đề thi chưa có câu hỏi, không thể gửi duyệt' });
    }

    // Validate tổng điểm phải đúng 10 (chuẩn Thông tư 22)
    const totalScore = await ExamModel.getTotalScore(req.params.id);
    const REQUIRED_TOTAL = 10;
    if (Math.abs(totalScore - REQUIRED_TOTAL) > 0.01) {
      return res.status(409).json({
        message: `Tổng điểm đề thi phải đúng ${REQUIRED_TOTAL} điểm (hiện tại: ${totalScore} điểm)`,
        current_total: totalScore,
        required_total: REQUIRED_TOTAL,
      });
    }

    const updated = await ExamModel.submitForApproval(req.params.id);
    if (!updated) return res.status(409).json({ message: 'Đề thi không ở trạng thái bản nháp' });

    return res.status(200).json({ message: 'Đã gửi đề lên tổ trưởng', exam: updated });
  } catch (err) {
    console.error('submit exam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/exams/:id/approve — tổ trưởng duyệt
const approve = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    const updated = await ExamModel.approve(req.params.id, req.user.id);
    if (!updated) return res.status(409).json({ message: 'Đề không ở trạng thái chờ duyệt' });
    return res.status(200).json({ message: 'Đã phê duyệt đề thi', exam: updated });
  } catch (err) {
    console.error('approve exam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/exams/:id/reject — tổ trưởng từ chối
// Body: { reason: "Câu 3 bị lỗi đáp án, câu 7 chưa đủ mức độ vận dụng cao" }
const reject = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Vui lòng ghi rõ lý do từ chối để giáo viên biết cần sửa gì' });
    }

    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    const updated = await ExamModel.reject(req.params.id, reason.trim());
    if (!updated) return res.status(409).json({ message: 'Đề không ở trạng thái chờ duyệt' });
    return res.status(200).json({ message: 'Đã từ chối, đề quay về bản nháp', exam: updated });
  } catch (err) {
    console.error('reject exam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// EXAM SCHEDULES — LÊN LỊCH THI
// ============================================================

// GET /api/exams/schedules?class_id=...&exam_id=...
const getSchedules = async (req, res) => {
  try {
    const { exam_id, class_id, is_active } = req.query;

    // Học sinh chỉ xem lịch thi của lớp mình
    const resolvedClassId = req.user.role === 'student'
      ? req.user.class_id
      : class_id;

    let schedules = await ExamModel.findSchedules({
      exam_id,
      class_id: resolvedClassId,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
    });

    // [MỚI] Xử lý Lớp ghép: Lọc những kỳ thi thuộc môn học của học sinh
    if (req.user.role === 'student') {
      const UserModel = require('../models/user.model');
      const userProfile = await UserModel.findById(req.user.id);
      const mySubjects = userProfile.subject_ids || [];
      schedules = schedules.filter(s => mySubjects.includes(s.subject_id));
    }

    return res.status(200).json({ schedules });
  } catch (err) {
    console.error('getSchedules error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/exams/schedules
// Tạo lịch thi cho lớp — chỉ admin hoặc tổ trưởng
// Body: { exam_id, class_id, start_time, end_time }
const createSchedule = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { exam_id, class_id, start_time, end_time, review_mode } = req.body;

  try {
      const exam = await ExamModel.findById(exam_id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên môn học của đề thi này' });
    }

    if (exam.status !== 'approved') {
      return res.status(409).json({ message: 'Chỉ có thể lên lịch cho đề thi đã được phê duyệt' });
    }

    // Giáo viên chỉ được lên lịch cho lớp mình được phân công dạy môn đó
    if (req.user.role !== 'admin') {
      const { query } = require('../config/db');
      const { rows } = await query(
        `SELECT 1 FROM class_subjects WHERE class_id = $1 AND subject_id = $2 AND teacher_id = $3`,
        [class_id, exam.subject_id, req.user.id]
      );
      if (rows.length === 0) {
        return res.status(403).json({ message: 'Bạn chỉ được phép lên lịch thi cho các lớp đã được phân công dạy môn này' });
      }
    }

    // Kiểm tra giờ kết thúc phải sau giờ bắt đầu
    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu' });
    }

    // Kiểm tra giờ bắt đầu phải trong tương lai
    if (new Date(start_time) <= new Date()) {
      return res.status(400).json({ message: 'Giờ bắt đầu phải trong tương lai' });
    }

    // Kiểm tra lớp này có lịch thi nào đang active mà trùng khung giờ không
    const existingSchedules = await ExamModel.findSchedules({ class_id, is_active: true });
    const hasOverlap = existingSchedules.some(s => {
      const sStart = new Date(s.start_time);
      const sEnd   = new Date(s.end_time);
      const newStart = new Date(start_time);
      const newEnd   = new Date(end_time);
      // Hai khoảng thời gian giao nhau nếu: newStart < sEnd VÀ newEnd > sStart
      return newStart < sEnd && newEnd > sStart;
    });

    if (hasOverlap) {
      return res.status(409).json({
        message: 'Lớp này đã có lịch thi khác trong khung giờ này',
      });
    }

    const existingSchedule = await ExamModel.findScheduleByExamClass(exam_id, class_id);
    if (existingSchedule) {
      if (existingSchedule.is_active) {
        return res.status(409).json({ message: 'Lớp này đã có lịch thi cho đề thi này' });
      }
      const schedule = await ExamModel.updateSchedule(existingSchedule.id, { start_time, end_time });
      return res.status(200).json({ message: 'Đã tạo lại lịch thi cho đề thi này', schedule });
    }

    const schedule = await ExamModel.createSchedule({ exam_id, class_id, start_time, end_time, review_mode: review_mode || 'after_close' });
    return res.status(201).json({ message: 'Lên lịch thi thành công', schedule });
  } catch (err) {
    // Bắt lỗi trùng lịch (UNIQUE exam_id + class_id)
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Lớp này đã có lịch thi cho đề thi này' });
    }
    console.error('createSchedule error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/exams/schedules/:id/cancel — hủy lịch thi
const cancelSchedule = async (req, res) => {
  try {
    const schedule = await ExamModel.cancelSchedule(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Không tìm thấy lịch thi' });
    return res.status(200).json({ message: 'Đã hủy lịch thi', schedule });
  } catch (err) {
    console.error('cancelSchedule error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/exams/schedules/:id — dời lịch thi (update times)
const updateSchedule = async (req, res) => {
  try {
    const { start_time, end_time } = req.body;
    if (!start_time || !end_time) return res.status(400).json({ message: 'Cần cung cấp start_time và end_time' });

    if (new Date(end_time) <= new Date(start_time)) {
      return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu' });
    }
    if (new Date(start_time) <= new Date()) {
      return res.status(400).json({ message: 'Giờ bắt đầu phải trong tương lai' });
    }

    // Kiểm tra trùng khung giờ với các lịch active khác của lớp (loại trừ chính lịch này)
    const existingSchedules = await ExamModel.findSchedules({ class_id: req.body.class_id, is_active: true });
    const hasOverlap = existingSchedules
      .filter(s => s.id !== req.params.id)
      .some(s => {
        const sStart = new Date(s.start_time);
        const sEnd   = new Date(s.end_time);
        const newStart = new Date(start_time);
        const newEnd   = new Date(end_time);
        return newStart < sEnd && newEnd > sStart;
      });

    if (hasOverlap) {
      return res.status(409).json({ message: 'Lớp này đã có lịch thi khác trong khung giờ này' });
    }

    const updated = await ExamModel.updateSchedule(req.params.id, { start_time, end_time });
    if (!updated) return res.status(404).json({ message: 'Không tìm thấy lịch thi' });
    return res.status(200).json({ message: 'Đã cập nhật lịch thi', schedule: updated });
  } catch (err) {
    console.error('updateSchedule error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// DELETE /api/exams/schedules/:id — xóa hoàn toàn lịch thi
const deleteSchedule = async (req, res) => {
  try {
    const deleted = await ExamModel.deleteSchedule(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Không tìm thấy lịch thi' });
    return res.status(200).json({ message: 'Đã xóa lịch thi' });
  } catch (err) {
    console.error('deleteSchedule error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};



// ============================================================
// EXAM MATRIX — ma trận đề thi (Thông tư 22)
// ============================================================

// GET /api/exams/:id/matrix
// Xem ma trận + summary của 1 đề thi
const getMatrix = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    if (req.user.role === 'teacher' && exam.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
    }

    const [matrix, summary] = await Promise.all([
      ExamModel.getMatrix(req.params.id),
      ExamModel.getMatrixSummary(req.params.id),
    ]);

    return res.status(200).json({ matrix, summary: summary || null });
  } catch (err) {
    console.error('getMatrix error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/exams/:id/matrix
// Giáo viên nhập/cập nhật ma trận đề (chỉ được khi status = draft)
// CV 7991: 3 mức Biết/Hiểu/Vận dụng
// Body: {
//   matrix: [
//     { type: "multiple_choice", difficulty: "nhan_biet",  question_count: 6, score_per_question: 0.25 },
//     { type: "multiple_choice", difficulty: "thong_hieu", question_count: 4, score_per_question: 0.25 },
//     { type: "true_false",      difficulty: "van_dung",   question_count: 2, score_per_question: 1.00 },
//     { type: "essay",           difficulty: "van_dung",   question_count: 1, score_per_question: 2.00 },
//   ]
// }
const setMatrix = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    if (req.user.role === 'teacher' && exam.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đề thi này' });
    }
    if (exam.status !== 'draft') {
      return res.status(409).json({ message: 'Chỉ có thể chỉnh sửa ma trận khi đề đang ở bản nháp' });
    }

    const { matrix } = req.body;
    if (!Array.isArray(matrix) || matrix.length === 0) {
      return res.status(400).json({ message: 'Cần cung cấp ít nhất 1 dòng trong ma trận' });
    }

    // Validate từng dòng ma trận
    const VALID_TYPES = ['multiple_choice', 'true_false', 'short_answer', 'essay'];
    const VALID_DIFFICULTIES = ['nhan_biet', 'thong_hieu', 'van_dung']; // CV 7991/BGDĐT: 3 mức Biết/Hiểu/Vận dụng
    for (const [i, row] of matrix.entries()) {
      if (!VALID_TYPES.includes(row.type)) {
        return res.status(400).json({ message: `Dòng ${i + 1}: type không hợp lệ (${row.type})` });
      }
      if (!VALID_DIFFICULTIES.includes(row.difficulty)) {
        return res.status(400).json({ message: `Dòng ${i + 1}: difficulty không hợp lệ (${row.difficulty})` });
      }
      if (!row.question_count || row.question_count < 1) {
        return res.status(400).json({ message: `Dòng ${i + 1}: question_count phải >= 1` });
      }
      if (!row.score_per_question || row.score_per_question <= 0) {
        return res.status(400).json({ message: `Dòng ${i + 1}: score_per_question phải > 0` });
      }
    }

    // Kiểm tra trùng tổ hợp type + difficulty trong cùng 1 request
    const seen = new Set();
    for (const [i, row] of matrix.entries()) {
      const key = `${row.type}__${row.difficulty}`;
      if (seen.has(key)) {
        return res.status(400).json({
          message: `Dòng ${i + 1}: tổ hợp ${row.type} × ${row.difficulty} bị trùng trong ma trận`,
        });
      }
      seen.add(key);
    }

    // Tính trước tổng điểm để báo lỗi thân thiện hơn
    const previewTotal = matrix.reduce(
      (sum, r) => sum + r.question_count * r.score_per_question, 0
    );
    if (Math.abs(previewTotal - 10) > 0.01) {
      return res.status(409).json({
        message: `Tổng điểm ma trận phải đúng 10 (hiện tại: ${previewTotal.toFixed(2)} điểm)`,
        current_total: parseFloat(previewTotal.toFixed(2)),
        required_total: 10,
      });
    }

    const saved = await ExamModel.setMatrix(req.params.id, matrix);
    return res.status(200).json({
      message: `Đã lưu ma trận ${saved.length} nhóm câu hỏi`,
      matrix: saved,
    });
  } catch (err) {
    // Lỗi từ model (ví dụ tổng điểm sai sau khi tính lại chính xác hơn)
    if (err.message.startsWith('Ma trận không hợp lệ')) {
      return res.status(409).json({ message: err.message });
    }
    console.error('setMatrix error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/exams/:id/auto-generate-from-matrix
// Tạo đề tự động DỰA TRÊN ma trận đã lưu — không cần truyền structure trong body
const autoGenerateFromMatrix = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    if (exam.status !== 'draft') {
      return res.status(409).json({ message: 'Chỉ có thể tạo đề ở trạng thái bản nháp' });
    }

    const matrix = await ExamModel.getMatrix(req.params.id);
    if (!matrix || matrix.length === 0) {
      return res.status(409).json({
        message: 'Đề thi chưa có ma trận. Hãy thiết lập ma trận trước (PUT /matrix)',
      });
    }

    const selectedQuestions = [];
    const usedIds = [];

    for (const row of matrix) {
      const { type, difficulty, question_count, score_per_question, topic_filter } = row;

      const found = await QuestionModel.findRandom({
        subject_id:  exam.subject_id,
        type,
        difficulty,
        topic_filter: topic_filter || undefined,
        exclude_ids: usedIds,
        limit:       question_count,
      });

      if (found.length < question_count) {
        return res.status(409).json({
          message: `Không đủ câu hỏi ${type} mức ${difficulty}${topic_filter ? ` (chủ đề: ${topic_filter})` : ''} — cần ${question_count}, có ${found.length}`,
          type,
          difficulty,
          required: question_count,
          available: found.length,
        });
      }

      found.forEach(q => {
        selectedQuestions.push({ question_id: q.id, score: score_per_question });
        usedIds.push(q.id);
      });
    }

    const updated = await ExamModel.addQuestions(req.params.id, selectedQuestions);
    return res.status(200).json({
      message: `Đã tạo tự động ${selectedQuestions.length} câu hỏi theo ma trận`,
      exam: updated,
    });
  } catch (err) {
    console.error('autoGenerateFromMatrix error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};



// ════════════════════════════════════════════════════════════════
// IMPORT FILE → TẠO ĐỀ THI
// POST /api/exams/import-file
// multipart/form-data:
//   file        — file .xlsx hoặc .docx chứa câu hỏi
//   title       — tên đề thi
//   subject_id  — UUID môn học
//   duration_minutes
//   description (tùy chọn)
//   questions_meta — JSON string: [{ index, score }] — điểm từng câu theo thứ tự
// ════════════════════════════════════════════════════════════════
const { parseExcel, parseWord } = require('../utils/questionImporter');

const importFileCreateExam = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file .xlsx hoặc .docx' });
    }

    const { title, subject_id, duration_minutes, description, questions_meta } = req.body;

    // Validate thông tin đề thi
    if (!title?.trim())    return res.status(400).json({ message: 'Vui lòng nhập tên đề thi' });
    if (!subject_id)       return res.status(400).json({ message: 'Vui lòng chọn môn học' });
    if (!duration_minutes) return res.status(400).json({ message: 'Vui lòng nhập thời gian làm bài' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền tạo đề thi cho môn học này' });
    }

    // Parse file
    const ext    = req.file.originalname.split('.').pop().toLowerCase();
    const buffer = req.file.buffer;
    let parsed;

    if (['xlsx', 'xls'].includes(ext)) {
      parsed = parseExcel(buffer);
    } else if (['docx', 'doc'].includes(ext)) {
      parsed = await parseWord(buffer);
    } else {
      return res.status(400).json({ message: 'Chỉ hỗ trợ file .xlsx hoặc .docx' });
    }

    const { questions, errors: parseErrors } = parsed;

    if (questions.length === 0) {
      return res.status(422).json({
        message: 'Không có câu hỏi hợp lệ nào trong file',
        errors: parseErrors,
      });
    }

    // Lấy điểm từng câu từ frontend (nếu có), mặc định chia đều 10 điểm
    let meta = [];
    try { meta = questions_meta ? JSON.parse(questions_meta) : []; } catch {}

    const scoreMap = {};
    meta.forEach(m => { scoreMap[m.index] = parseFloat(m.score) || 0; });

    // Nếu không có meta → chia đều
    const defaultScore = parseFloat((10 / questions.length).toFixed(4));

    const { getClient } = require('../config/db');
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Tạo câu hỏi từ import — source='import', is_approved=true
      //    Câu hỏi này KHÔNG hiện trong ngân hàng, không cần tổ trưởng duyệt
      const questionIds = [];
      for (const q of questions) {
        const { rows } = await client.query(
          `INSERT INTO questions
             (subject_id, created_by, type, content, options, correct_answer, difficulty,
              source, is_approved)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'import',TRUE)
           RETURNING id`,
          [
            subject_id,
            req.user.id,
            q.type,
            q.content,
            q.options ? JSON.stringify(q.options) : null,
            JSON.stringify(q.correct_answer),
            q.difficulty,
          ]
        );
        questionIds.push(rows[0].id);
      }

      // 2. Tạo đề thi (status = draft)
      const { rows: examRows } = await client.query(
        `INSERT INTO exams (title, subject_id, created_by, duration_minutes, description, status)
         VALUES ($1,$2,$3,$4,$5,'draft')
         RETURNING *`,
        [
          title.trim(),
          subject_id,
          req.user.id,
          parseInt(duration_minutes),
          description?.trim() || null,
        ]
      );
      const exam = examRows[0];

      // 3. Gán câu hỏi vào đề với điểm tương ứng
      for (let i = 0; i < questionIds.length; i++) {
        const score = scoreMap[i] !== undefined ? scoreMap[i] : defaultScore;
        await client.query(
          `INSERT INTO exam_questions (exam_id, question_id, order_index, score)
           VALUES ($1,$2,$3,$4)`,
          [exam.id, questionIds[i], i + 1, score]
        );
      }

      await client.query('COMMIT');

      return res.status(201).json({
        message: `Tạo đề thi thành công với ${questions.length} câu hỏi${parseErrors.length > 0 ? `, bỏ qua ${parseErrors.length} dòng lỗi` : ''}`,
        exam: { ...exam, question_count: questions.length },
        imported:    questions.length,
        skipped:     parseErrors.length,
        parse_errors: parseErrors,
      });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('importFileCreateExam error:', err);
    return res.status(500).json({ message: 'Lỗi server khi xử lý file' });
  }
};

// POST /api/exams/parse-file — parse file trả về câu hỏi, KHÔNG lưu DB
// Dùng cho bước 1 của ImportExamModal để preview trước khi tạo đề
const parseFileOnly = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng upload file' });
    const ext    = req.file.originalname.split('.').pop().toLowerCase();
    const buffer = req.file.buffer;
    let parsed;
    if (['xlsx','xls'].includes(ext))   parsed = parseExcel(buffer);
    else if (['docx','doc'].includes(ext)) parsed = await parseWord(buffer);
    else return res.status(400).json({ message: 'Chỉ hỗ trợ .xlsx hoặc .docx' });

    return res.status(200).json({
      questions: parsed.questions,
      errors:    parsed.errors,
      total:     parsed.questions.length,
    });
  } catch (err) {
    console.error('parseFileOnly error:', err);
    return res.status(500).json({ message: 'Lỗi server khi parse file' });
  }
};

// DELETE /api/exams/:id — xóa đề thi
const deleteExam = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const exam = await ExamModel.findById(id);
    if (!exam) return res.status(404).json({ message: 'Đề thi không tồn tại' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa đề thi này' });
    }

    // Authorization: chỉ người tạo đề hoặc admin/department_head được xóa
    if (req.user.role === 'teacher' && exam.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa đề thi này' });
    }

    const result = await ExamModel.deleteExam(id);
    if (!result) return res.status(404).json({ message: 'Không thể xóa đề thi' });

    res.json({ message: 'Xóa đề thi thành công', exam_id: id });
  } catch (error) {
    console.error('[deleteExam]', error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/exams/:id/export
const exportExcel = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
    }

    if (req.user.role === 'teacher' && exam.created_by !== req.user.id && exam.status !== 'approved') {
      return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
    }

    // Định dạng loại câu hỏi
    const typeMap = {
      multiple_choice: 'Trắc nghiệm',
      true_false: 'Đúng/Sai',
      short_answer: 'Trả lời ngắn',
      essay: 'Tự luận'
    };

    // Định dạng độ khó — theo CV 7991/BGDĐT-GDTrH ngày 17/12/2024 (3 mức)
    const difficultyMap = {
      nhan_biet:  'Biết',
      thong_hieu: 'Hiểu',
      van_dung:   'Vận dụng',
    };

    const questionsData = exam.questions.map((q, index) => {
      // Parse options
      let optionsStr = '';
      if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
        optionsStr = q.options.map(opt => `${opt.id}. ${opt.text || ''}`).join('\n');
      } else if (q.type === 'true_false' && Array.isArray(q.options)) {
        optionsStr = q.options.map(opt => `${opt.id}. ${opt.statement || opt.text || ''}`).join('\n');
      }

      // Xử lý đáp án đúng
      let correctAnswerStr = q.correct_answer;
      try {
        if (q.type === 'multiple_choice') {
          if (q.correct_answer && Array.isArray(q.correct_answer.selected)) {
            correctAnswerStr = q.correct_answer.selected.join(', ');
          }
        } else if (q.type === 'true_false') {
          if (q.correct_answer && q.correct_answer.answers) {
            correctAnswerStr = Object.entries(q.correct_answer.answers)
              .map(([k, v]) => `${k}: ${v ? 'Đúng' : 'Sai'}`)
              .join('\n');
          }
        } else if (q.type === 'short_answer') {
          if (Array.isArray(q.correct_answer)) {
            correctAnswerStr = q.correct_answer.join(' | ');
          } else if (q.correct_answer && typeof q.correct_answer === 'object') {
             correctAnswerStr = JSON.stringify(q.correct_answer);
          }
        } else if (q.type === 'essay') {
          if (q.correct_answer && q.correct_answer.sample) {
            correctAnswerStr = q.correct_answer.sample;
          }
        }
      } catch (e) {
        correctAnswerStr = JSON.stringify(q.correct_answer);
      }

      // Bỏ các tag HTML cơ bản khỏi content (nếu muốn excel sạch)
      const cleanContent = (q.content || '').replace(/<[^>]*>?/gm, '');

      return {
        'STT': index + 1,
        'Loại câu hỏi': typeMap[q.type] || q.type,
        'Độ khó': difficultyMap[q.difficulty] || q.difficulty,
        'Nội dung câu hỏi': cleanContent,
        'Các lựa chọn': optionsStr,
        'Đáp án đúng': correctAnswerStr,
        'Điểm': q.score
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(questionsData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "DanhSachCauHoi");

    // Tạo buffer
    const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename="De_Thi_${exam.id.substring(0,8)}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error('exportExcel error:', err);
    res.status(500).json({ message: 'Lỗi server khi xuất Excel' });
  }
};

const exportWord = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền xuất đề thi này' });
    }

    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = require('docx');

    const typeLabel = { multiple_choice: 'Trắc nghiệm', true_false: 'Đúng/Sai', short_answer: 'Trả lời ngắn', essay: 'Tự luận' };
    const diffLabel = { nhan_biet: 'Biết', thong_hieu: 'Hiểu', van_dung: 'Vận dụng' };

    const children = [];

    // Tiêu đề đề thi
    children.push(
      new Paragraph({ text: exam.title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Môn: ${exam.subject_name || ''}   |   Thời gian: ${exam.duration_minutes} phút`, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: '' }) // dòng trống
    );

    // Từng câu hỏi
    exam.questions.forEach((q, idx) => {
      const cleanContent = (q.content || '').replace(/<[^>]*>/g, '');

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Câu ${idx + 1}. `, bold: true }),
            new TextRun({ text: `[${typeLabel[q.type] || q.type}] [${diffLabel[q.difficulty] || q.difficulty}]`, color: '888888' }),
            new TextRun({ text: `  ${cleanContent}` }),
          ],
          spacing: { before: 200 },
        })
      );

      // Lựa chọn cho trắc nghiệm
      if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
        q.options.forEach((opt, i) => {
          const isStr = typeof opt === 'string';
          const label = isStr ? String.fromCharCode(65 + i) : (opt.id || String.fromCharCode(65 + i));
          const text  = isStr ? opt : (opt.text || '');
          children.push(new Paragraph({
            text: `    ${label}. ${text}`,
            indent: { left: 720 },
          }));
        });
      }

      // Mệnh đề cho đúng/sai
      if (q.type === 'true_false' && Array.isArray(q.options)) {
        q.options.forEach((opt, i) => {
          const isStr = typeof opt === 'string';
          const label = String.fromCharCode(97 + i); // a, b, c, d
          const statement = isStr ? opt : (opt.statement || '');
          children.push(new Paragraph({
            text: `    ${label}) ${statement}`,
            indent: { left: 720 },
          }));
        });
      }

      // Đáp án (in nhỏ màu xám — giáo viên có thể xóa khi in cho học sinh)
      let answerText = '';
      let ca = q.correct_answer;
      if (typeof ca === 'string') {
        try { ca = JSON.parse(ca); } catch (e) { ca = {}; }
      }

      if (q.type === 'multiple_choice') {
        if (Array.isArray(ca)) answerText = `Đáp án: ${ca.join(', ')}`;
        else answerText = `Đáp án: ${ca?.selected?.join(', ') || ''}`;
      }
      else if (q.type === 'true_false') {
        if (ca?.answers) {
          const parts = Object.entries(ca.answers).map(([k, v]) => `${k}:${v ? 'Đ' : 'S'}`);
          answerText = `Đáp án: ${parts.join(', ')}`;
        } else if (Array.isArray(ca)) {
          answerText = `Đáp án: ${ca.join(', ')}`;
        }
      }
      else if (q.type === 'short_answer') {
        if (Array.isArray(ca)) answerText = `Đáp án: ${ca.join(' / ')}`;
        else answerText = `Đáp án: ${ca?.accepted?.join(' / ') || ''}`;
      }
      else if (q.type === 'essay') {
        if (ca?.keywords) answerText = `Từ khóa: ${ca.keywords.join(', ')}`;
        else if (ca?.sample) answerText = `Đáp án mẫu: ${ca.sample}`;
      }

      if (answerText) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `    ${answerText}`, color: 'AAAAAA', italics: true, size: 18 })],
        }));
      }
    });

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    const safeName = exam.title.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/g, '').trim();
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return res.send(buffer);

  } catch (err) {
    console.error('exportWord error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// NGHIỆP VỤ GDPT 2018
// ============================================================

// POST /api/exams/:id/generate-rooms
// Trộn phòng thi động cho bài kiểm tra (Giữa kỳ / Cuối kỳ)
const generateRooms = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    // Cần quyền admin hoặc tổ trưởng để trộn phòng thi
    if (req.user.role !== 'admin' && req.user.role !== 'department_head') {
      return res.status(403).json({ message: 'Chỉ Admin hoặc Tổ trưởng bộ môn mới được xếp phòng thi' });
    }

    const result = await ExamRoomsModel.generateRooms(exam.id, exam.subject_id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('generateRooms error:', err);
    return res.status(500).json({ message: err.message || 'Lỗi server khi xếp phòng thi' });
  }
};

// GET /api/exams/:id/rooms
// Lấy danh sách phòng thi của bài kiểm tra
const getRooms = async (req, res) => {
  try {
    const rooms = await ExamRoomsModel.findByExamId(req.params.id);
    return res.status(200).json({ rooms });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/exams/rooms/:roomId/students
// Lấy danh sách học sinh trong phòng thi
const getRoomStudents = async (req, res) => {
  try {
    const students = await ExamRoomsModel.findStudentsByRoomId(req.params.roomId);
    return res.status(200).json({ students });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/exams/:id/trigger
// Kích hoạt bài kiểm tra thường xuyên (Pending -> Active)
const triggerExam = async (req, res) => {
  try {
    const exam = await ExamModel.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Không tìm thấy đề thi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, exam.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác trên đề thi này' });
    }

    // Đổi trạng thái từ approved -> active (hoặc tương tự)
    // Cần update trực tiếp bằng câu query
    const { query } = require('../config/db');
    await query("UPDATE exams SET status = 'active' WHERE id = $1", [exam.id]);

    return res.status(200).json({ message: 'Đã kích hoạt bài kiểm tra' });
  } catch (err) {
    console.error('triggerExam error:', err);
    return res.status(500).json({ message: 'Lỗi server khi kích hoạt đề thi' });
  }
};

module.exports = {
  getAll, getById, create, update, setQuestions, autoGenerate,
  submit, approve, reject,
  getSchedules, createSchedule, cancelSchedule,
  updateSchedule, deleteSchedule, deleteExam,
  getMatrix, setMatrix, autoGenerateFromMatrix,
  importFileCreateExam, parseFileOnly, exportExcel, exportWord,
  generateRooms, getRooms, getRoomStudents, triggerExam
};
