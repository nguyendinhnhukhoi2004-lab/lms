// controllers/submissions.controller.js
// Toàn bộ luồng phòng thi:
//   1. Vào phòng thi (enter)      → tạo submission + đề xáo trộn
//   2. Lưu câu trả lời (answer)   → auto-save từng câu
//   3. Nộp bài (submit)           → chấm trắc nghiệm tự động + gọi NLP
//   4. Xem kết quả (result)       → trả điểm và đáp án sau khi nộp
//   5. Giáo viên chỉnh điểm (grade) → sửa điểm tự luận

const ExamModel       = require('../models/exam.model');
const SubmissionModel = require('../models/submission.model');
const QuestionModel   = require('../models/question.model');
const { gradeSubmission } = require('../utils/grader');
const { gradeEssay, gradeEssayBatch } = require('../utils/nlpService');

// ─── Helper: Tạo snapshot đề thi không xáo trộn ─────────────────
// Trả về: { order: [q_id,...], option_shuffle: {} }
const buildShuffledOrder = (questions) => {
  const order = questions.map(q => q.id);
  const option_shuffle = {};
  return { order, option_shuffle };
};

// ─── Helper: Áp dụng option shuffle nếu có trước khi gửi client ──
// Nếu không có shuffleIndices, giữ nguyên thứ tự options ban đầu
const applyOptionShuffle = (question, shuffleIndices) => {
  if (!shuffleIndices || !Array.isArray(question.options)) return question;
  const shuffledOptions = shuffleIndices.map(i => question.options[i]);
  return { ...question, options: shuffledOptions };
};

// ============================================================
// 1. VÀO PHÒNG THI
// POST /api/submissions/enter
// Body: { schedule_id }
// ============================================================
const enter = async (req, res) => {
  const { schedule_id } = req.body;
  if (!schedule_id) {
    return res.status(400).json({ message: 'Thiếu schedule_id' });
  }

  try {
    // FIX: Query thẳng theo id thay vì tải toàn bộ bảng rồi filter JS
    const schedule = await ExamModel.findScheduleById(schedule_id);

    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch thi' });
    }

    // Kiểm tra lịch thi có đang hoạt động không
    if (!schedule.is_active) {
      return res.status(403).json({ message: 'Lịch thi đã bị hủy' });
    }

    // Kiểm tra đúng khung giờ thi
    const now = new Date();
    if (now < new Date(schedule.start_time)) {
      return res.status(403).json({ message: 'Chưa đến giờ thi' });
    }
    if (now > new Date(schedule.end_time)) {
      return res.status(403).json({ message: 'Đã hết giờ thi' });
    }

    // FIX: So sánh UUID dạng string, trim để tránh khoảng trắng thừa
    if (String(req.user.class_id).trim() !== String(schedule.class_id).trim()) {
      return res.status(403).json({ message: 'Bạn không thuộc lớp thi này' });
    }

    // [MỚI] Kiểm tra học sinh có thuộc danh sách thi môn này không (Xử lý Lớp ghép)
    const UserModel = require('../models/user.model');
    const userProfile = await UserModel.findById(req.user.id);
    const exam = await ExamModel.findById(schedule.exam_id);
    
    if (!userProfile.subject_ids || !userProfile.subject_ids.includes(exam.subject_id)) {
      return res.status(403).json({ message: 'Bạn không có tên trong danh sách thi môn này (Tổ hợp môn không khớp)' });
    }

    // Kiểm tra đã vào thi chưa
    const existing = await SubmissionModel.findByStudentAndSchedule(
      req.user.id, schedule_id
    );

    if (existing) {
      if (existing.status === 'in_progress') {
        // Đã vào thi rồi: trả lại đề cũ (cùng thứ tự xáo trộn)
        // Tránh tải lại trang mất đề
        // const exam = await ExamModel.findById(schedule.exam_id); // Đã gọi ở trên
        const questionsForStudent = buildQuestionsForClient(
          exam.questions,
          existing.question_order
        );

        const savedAnswers = await SubmissionModel.findAnswers(existing.id);

        return res.status(200).json({
          message:       'Tiếp tục bài thi',
          submission_id: existing.id,
          submission_status: existing.status,
          exam: {
            title:            exam.title,
            duration_minutes: exam.duration_minutes,
            end_time:         schedule.end_time,
          },
          questions:    questionsForStudent,
          savedAnswers, // trả lại đáp án đã lưu trước đó
        });
      }

      const result = await SubmissionModel.findResult(existing.id);
      const answers = await SubmissionModel.findAnswers(existing.id);
      // const exam = await ExamModel.findById(schedule.exam_id); // Đã gọi ở trên
      const examQuestionMap = {};
      exam.questions.forEach(q => { examQuestionMap[q.id] = q; });
      const detailedAnswers = answers.map(a => ({
        ...a,
        max_score:     examQuestionMap[a.question_id]?.score,
        sample_answer: a.correct_answer?.sample || null,
      }));

      return res.status(200).json({
        message:           'Bài thi đã được nộp trước đó',
        submission_id:     existing.id,
        submission_status: existing.status,
        result,
        answers:           detailedAnswers,
      });
    }

    // Lần đầu vào thi: tạo submission mới + xáo trộn đề
    // const exam = await ExamModel.findById(schedule.exam_id); // Đã gọi ở trên
    if (!exam || !exam.questions || exam.questions.length === 0) {
      return res.status(500).json({ message: 'Đề thi không có câu hỏi' });
    }

    // Tạo snapshot xáo trộn — lưu vào DB để chấm đúng sau này
    const questionOrder = buildShuffledOrder(exam.questions);

    const submission = await SubmissionModel.create(
      req.user.id, schedule_id, questionOrder
    );

    // Build đề thi theo thứ tự xáo trộn để gửi cho học sinh
    const questionsForStudent = buildQuestionsForClient(exam.questions, questionOrder);

    return res.status(201).json({
      message:       'Vào phòng thi thành công',
      submission_id: submission.id,
      exam: {
        title:            exam.title,
        duration_minutes: exam.duration_minutes,
        end_time:         schedule.end_time,
      },
      questions: questionsForStudent,
    });
  } catch (err) {
    console.error('enter exam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Helper: build danh sách câu hỏi gửi cho học sinh
// - Áp dụng thứ tự xáo trộn từ snapshot
// - KHÔNG gửi correct_answer
const buildQuestionsForClient = (questions, questionOrder) => {
  const { order, option_shuffle } = questionOrder;
  const questionMap = {};
  questions.forEach(q => { questionMap[q.id] = q; });

  return order.map((qId, index) => {
    const q = questionMap[qId];
    if (!q) return null;

    // Áp dụng xáo trộn options nếu có
    const shuffled = applyOptionShuffle(q, option_shuffle[qId]);

    // Loại bỏ correct_answer trước khi gửi client
    const { correct_answer, ...safeQuestion } = shuffled;

    return {
      ...safeQuestion,
      display_index: index + 1, // số thứ tự hiển thị (Câu 1, Câu 2...)
    };
  }).filter(Boolean);
};

// ============================================================
// 2. LƯU CÂU TRẢ LỜI (AUTO-SAVE)
// POST /api/submissions/:id/answer
// Body: { question_id, student_answer }
// ============================================================
const saveAnswer = async (req, res) => {
  const { question_id, student_answer } = req.body;
  if (!question_id || student_answer === undefined) {
    return res.status(400).json({ message: 'Thiếu question_id hoặc student_answer' });
  }

  try {
    const submission = await SubmissionModel.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    // Chỉ học sinh của bài thi này mới được lưu
    if (submission.student_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền truy cập bài thi này' });
    }

    // Không cho lưu sau khi đã nộp
    if (submission.status !== 'in_progress') {
      return res.status(409).json({ message: 'Bài thi đã nộp, không thể thay đổi đáp án' });
    }

    // Kiểm tra còn trong khung giờ không
    if (new Date() > new Date(submission.end_time)) {
      return res.status(403).json({ message: 'Đã hết giờ thi' });
    }

    // Kiểm tra câu hỏi có trong đề không (tránh gian lận)
    // FIX: trim() và toString() để tránh type/whitespace mismatch khi so sánh UUID
    const order = (submission.question_order?.order || []).map(id => String(id).trim());
    if (!order.includes(String(question_id).trim())) {
      return res.status(400).json({ message: 'Câu hỏi không thuộc đề thi của bạn' });
    }

    const answer = await SubmissionModel.upsertAnswer(
      req.params.id, question_id, student_answer
    );

    return res.status(200).json({ message: 'Đã lưu câu trả lời', answer });
  } catch (err) {
    console.error('saveAnswer error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// 3. NỘP BÀI
// POST /api/submissions/:id/submit
// ============================================================
const submitExam = async (req, res) => {
  try {
    const submission = await SubmissionModel.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    if (submission.student_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền truy cập bài thi này' });
    }

    if (submission.status !== 'in_progress') {
      return res.status(409).json({ message: 'Bài thi đã được nộp trước đó' });
    }

    // Đánh dấu đã nộp
    const submitted = await SubmissionModel.submit(req.params.id);
    if (!submitted) {
      return res.status(409).json({ message: 'Không thể nộp bài' });
    }

    // Lấy đề thi đầy đủ (có correct_answer để chấm)
    const exam = await ExamModel.findById(submission.exam_id);

    // Lấy tất cả câu trả lời của học sinh
    const answers = await SubmissionModel.findAnswers(req.params.id);

    // ── Chấm trắc nghiệm và đúng/sai tự động ──────────────
    const autoScores = gradeSubmission(exam.questions, answers);
    const normalizedScores = autoScores.map(({ question_id, auto_score }) => ({
      question_id,
      auto_score: Number.isFinite(Number(auto_score)) ? parseFloat(Number(auto_score).toFixed(2)) : 0,
    }));
    await SubmissionModel.saveAutoScores(req.params.id, normalizedScores);

    // ── Gọi Python NLP để chấm câu tự luận và chờ kết quả ──
    // Thực hiện đồng bộ: gọi batch grading, lưu điểm gợi ý và dùng auto_score làm final_score
    const essayQuestions = exam.questions.filter(q => q.type === 'essay');
    if (essayQuestions.length > 0) {
      try {
        const essays = essayQuestions.map(q => ({
          question_id: q.id,
          student_text: (answers.find(a => a.question_id === q.id)?.student_answer?.text) || '',
          sample_text:  q.correct_answer?.sample || '',
          keywords:     q.correct_answer?.keywords || [],
          max_score:    q.score,
        }));

        const batchResults = await gradeEssayBatch(essays);

        let nlpFailedCount = 0;
        for (const r of batchResults) {
          if (r.similarity_score !== null) {
            // Lưu điểm gợi ý và độ tương đồng
            await SubmissionModel.saveSimilarityScore(
              req.params.id, r.question_id, r.similarity_score, r.auto_score
            );
            // Gắn auto_score làm final_score tự động (học sinh nhận điểm ngay)
            await SubmissionModel.updateFinalScore(req.params.id, r.question_id, r.auto_score);
          } else {
            // NLP thất bại — đánh dấu cần chấm thủ công
            await SubmissionModel.saveSimilarityScore(req.params.id, r.question_id, -1, null);
            nlpFailedCount++;
            console.warn(`[NLP] Câu ${r.question_id} trong submission ${req.params.id} cần chấm thủ công`);
          }
        }
        if (nlpFailedCount > 0) {
          console.warn(`[NLP] submission ${req.params.id}: ${nlpFailedCount}/${essayQuestions.length} câu tự luận cần chấm thủ công`);
        }
      } catch (err) {
        console.error('Lỗi khi gọi NLP (block submit):', err);
        // Nếu NLP có lỗi, fallback: đánh dấu các tự luận cần chấm thủ công
        for (const q of essayQuestions) {
          await SubmissionModel.saveSimilarityScore(req.params.id, q.id, -1, null);
        }
      }
    }

    // ── Tính tổng điểm (bao gồm tự luận đã được gán final_score = auto_score)
    const maxScore = exam.questions.reduce((s, q) => s + Number(q.score || 0), 0);
    // Lấy lại tất cả câu trả lời để tính toán dựa trên final_score
    const allAnswersAfter = await SubmissionModel.findAnswers(req.params.id);
    const totalFinal = allAnswersAfter.reduce((s, a) => s + Number(a.final_score || 0), 0);

    const roundedMaxScore = Number.isFinite(maxScore) ? parseFloat(maxScore.toFixed(2)) : 0;
    const roundedTotalFinal = Number.isFinite(totalFinal) ? parseFloat(totalFinal.toFixed(2)) : 0;

    // Tạo bản ghi kết quả cuối cùng
    const result = await SubmissionModel.createResult(
      req.params.id,
      req.user.id,
      submission.exam_id,
      roundedTotalFinal,
      roundedMaxScore
    );

    return res.status(200).json({
      message: 'Nộp bài thành công',
      result: {
        total_score: result.total_score,
        max_score:   result.max_score,
        note: essayQuestions.length > 0
          ? 'Câu tự luận đang được chấm, điểm sẽ cập nhật sau'
          : null,
      },
    });
  } catch (err) {
    console.error('submitExam error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Chạy nền: gọi NLP service cho từng câu tự luận, cập nhật DB
const gradeEssaysAsync = async (submission_id, essayQuestions, answers) => {
  const answerMap = {};
  answers.forEach(a => { answerMap[a.question_id] = a.student_answer; });

  // FIX: Dùng /grade-batch thay vì gọi /grade-essay từng câu một
  // Giảm từ N HTTP requests xuống còn 1 request
  const essays = essayQuestions.map(q => ({
    question_id:  q.id,
    student_text: answerMap[q.id]?.text || '',
    sample_text:  q.correct_answer?.sample || '',
    keywords:     q.correct_answer?.keywords || [],
    max_score:    q.score,
  }));

  const batchResults = await gradeEssayBatch(essays);

  let nlpFailedCount = 0;
  for (const r of batchResults) {
    if (r.similarity_score !== null) {
      await SubmissionModel.saveSimilarityScore(
        submission_id, r.question_id, r.similarity_score, r.auto_score
      );
    } else {
      // NLP thất bại — đánh dấu cần chấm thủ công
      await SubmissionModel.saveSimilarityScore(submission_id, r.question_id, -1, null);
      nlpFailedCount++;
      console.warn(`[NLP] Câu ${r.question_id} trong submission ${submission_id} cần chấm thủ công`);
    }
  }

  // Cập nhật tổng điểm sau khi chấm xong tự luận
  try {
    const result = await SubmissionModel.findResult(submission_id);
    if (result) {
      const allAnswers = await SubmissionModel.findAnswers(submission_id);
      const newTotal = allAnswers.reduce((s, a) => s + parseFloat(a.final_score || 0), 0);

      await SubmissionModel.createResult(
        submission_id,
        result.student_id,
        result.exam_id,
        parseFloat(newTotal.toFixed(2)),
        parseFloat(result.max_score)
      );

      if (nlpFailedCount > 0) {
        console.warn(
          `[NLP] submission ${submission_id}: ${nlpFailedCount}/${essayQuestions.length} câu tự luận cần chấm thủ công`
        );
      }
    }
  } catch (err) {
    console.error('Lỗi cập nhật tổng điểm sau NLP:', err);
  }
};

// ============================================================
// 4. XEM KẾT QUẢ
// GET /api/submissions/:id/result
// ============================================================
const getResult = async (req, res) => {
  try {
    const submission = await SubmissionModel.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    // Học sinh chỉ xem kết quả của mình; giáo viên/admin xem được tất cả
    if (req.user.role === 'student' && submission.student_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền xem kết quả này' });
    }

    // Chỉ cho xem kết quả sau khi đã nộp bài
    if (submission.status === 'in_progress') {
      return res.status(409).json({ message: 'Chưa nộp bài, không thể xem kết quả' });
    }

    const result  = await SubmissionModel.findResult(req.params.id);
    const answers = await SubmissionModel.findAnswers(req.params.id);

    // Lấy đề thi kèm correct_answer để hiển thị đáp án đúng sau khi thi
    const exam = await ExamModel.findById(submission.exam_id);

    // Map đáp án đúng vào từng câu trả lời để học sinh tự đối chiếu
    const examQuestionMap = {};
    exam.questions.forEach(q => { examQuestionMap[q.id] = q; });

    // ── Kiểm tra quyền xem lại đề ────────────────────────────────
    // Lấy lịch thi để biết review_mode
    let canReview   = false;
    let reviewMode  = 'after_close';
    let scheduleEndTime = null;
    try {
      const { query: dbQuery } = require('../config/db');
      const { rows: schRows } = await dbQuery(
        `SELECT review_mode, end_time FROM exam_schedules WHERE id = $1`,
        [submission.schedule_id]
      );
      if (schRows[0]) {
        reviewMode      = schRows[0].review_mode || 'after_close';
        scheduleEndTime = schRows[0].end_time;
      }
    } catch {}

    const now = new Date();
    if (reviewMode === 'after_submit') {
      canReview = true; // Xem ngay sau khi nộp
    } else if (reviewMode === 'after_close') {
      canReview = scheduleEndTime ? now > new Date(scheduleEndTime) : false;
    } else {
      canReview = false; // never
    }

    // Giáo viên, tổ trưởng, admin luôn được xem đáp án đúng
    if (['teacher', 'department_head', 'admin'].includes(req.user.role)) {
      canReview = true;
    }

    const detailedAnswers = answers.map(a => ({
      ...a,
      max_score:     examQuestionMap[a.question_id]?.score,
      sample_answer: a.correct_answer?.sample || null,
      // Chỉ trả về correct_answer nếu được phép xem lại
      correct_answer: canReview ? a.correct_answer : undefined,
    }));

    return res.status(200).json({
      result,
      answers: detailedAnswers,
      review: {
        can_review:    canReview,
        review_mode:   reviewMode,
        end_time:      scheduleEndTime,
      },
    });
  } catch (err) {
    console.error('getResult error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// 5. GIÁO VIÊN CHỈNH ĐIỂM TỰ LUẬN
// PATCH /api/submissions/:id/grade
// Body: { question_id, final_score }
// ============================================================
const gradeEssayManual = async (req, res) => {
  const { question_id, final_score } = req.body;

  if (!question_id || final_score === undefined) {
    return res.status(400).json({ message: 'Thiếu question_id hoặc final_score' });
  }

  try {
    const submission = await SubmissionModel.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }
    if (submission.status === 'in_progress') {
      return res.status(409).json({ message: 'Học sinh chưa nộp bài' });
    }

    // Kiểm tra điểm không vượt điểm tối đa câu hỏi
    const exam = await ExamModel.findById(submission.exam_id);

    // FIX: Giáo viên chỉ được chấm đề do mình tạo; admin và department_head không bị hạn chế
    if (req.user.role === 'teacher' && exam.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không có quyền chấm bài thi này' });
    }

    const examQuestion = exam.questions.find(q => q.id === question_id);
    if (!examQuestion) {
      return res.status(404).json({ message: 'Câu hỏi không thuộc đề thi này' });
    }
    if (final_score < 0 || final_score > examQuestion.score) {
      return res.status(400).json({
        message: `Điểm phải từ 0 đến ${examQuestion.score}`,
      });
    }

    // Cập nhật điểm
    const updated = await SubmissionModel.updateFinalScore(
      req.params.id, question_id, final_score
    );
    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy câu trả lời' });
    }

    // Tính lại tổng điểm
    const allAnswers = await SubmissionModel.findAnswers(req.params.id);
    const newTotal = allAnswers.reduce((s, a) => s + parseFloat(a.final_score || 0), 0);
    const result = await SubmissionModel.findResult(req.params.id);

    await SubmissionModel.createResult(
      req.params.id,
      result.student_id,
      result.exam_id,
      parseFloat(newTotal.toFixed(2)),
      parseFloat(result.max_score)
    );

    return res.status(200).json({
      message:    'Đã cập nhật điểm',
      answer:     updated,
      new_total:  parseFloat(newTotal.toFixed(2)),
    });
  } catch (err) {
    console.error('gradeEssayManual error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// ============================================================
// 6. XEM KẾT QUẢ TOÀN LỚP (GIÁO VIÊN)
// GET /api/submissions/schedule/:scheduleId/results
// ============================================================
const getClassResults = async (req, res) => {
  try {
    const results = await SubmissionModel.findResultsBySchedule(req.params.scheduleId);
    return res.status(200).json({ results });
  } catch (err) {
    console.error('getClassResults error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/submissions/my-results — học sinh xem lịch sử điểm của mình
const getMyResults = async (req, res) => {
  try {
    const results = await SubmissionModel.findResultsByStudent(req.user.id);
    return res.status(200).json({ results });
  } catch (err) {
    console.error('getMyResults error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = {
  enter, saveAnswer, submitExam,
  getResult, gradeEssayManual,
  getClassResults, getMyResults,
};
