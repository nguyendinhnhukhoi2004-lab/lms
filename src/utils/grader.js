// src/utils/grader.js
// Chấm điểm tự động cho câu trắc nghiệm và đúng/sai
// Câu tự luận được chấm gợi ý bởi Python NLP service (xem nlpService.js)

/**
 * Chấm 1 câu trắc nghiệm nhiều lựa chọn
 *
 * Quy tắc:
 *   - 1 đáp án đúng: đúng = full điểm, sai = 0
 *   - Nhiều đáp án đúng: chấm theo tỉ lệ số đáp án đúng chọn được
 *     (không trừ điểm cho đáp án sai chọn nhầm — tùy chính sách giáo viên)
 *
 * @param {Object} student_answer  - { selected: ["A", "C"] }
 * @param {Object} correct_answer  - { selected: ["A", "C"] }
 * @param {number} max_score       - điểm tối đa của câu
 * @returns {number} điểm đạt được
 */
const gradeMultipleChoice = (student_answer, correct_answer, max_score) => {
  const studentSelected = student_answer?.selected || [];
  const correctSelected = correct_answer?.selected || [];

  if (correctSelected.length === 0) return 0;

  // Nếu học sinh không chọn gì
  if (studentSelected.length === 0) return 0;

  // Trường hợp 1 đáp án: đúng hoặc sai
  if (correctSelected.length === 1) {
    return studentSelected[0] === correctSelected[0] ? max_score : 0;
  }

  // Trường hợp nhiều đáp án: chấm theo tỉ lệ đáp án đúng được chọn
  const correctSet = new Set(correctSelected);
  const correctChosen = studentSelected.filter(a => correctSet.has(a)).length;

  // Bị trừ điểm nếu chọn nhầm đáp án sai
  const wrongChosen = studentSelected.filter(a => !correctSet.has(a)).length;
  const netCorrect = Math.max(0, correctChosen - wrongChosen);

  return parseFloat(((netCorrect / correctSelected.length) * max_score).toFixed(2));
};

/**
 * Chấm 1 câu đúng/sai (nhiều mệnh đề)
 *
 * Quy tắc GDPT 2018:
 *   - 0 mệnh đề đúng:   0 điểm
 *   - 1 mệnh đề đúng: 10% điểm câu
 *   - 2 mệnh đề đúng: 25% điểm câu
 *   - 3 mệnh đề đúng: 50% điểm câu
 *   - 4 mệnh đề đúng: 100% điểm câu (full điểm)
 *
 * @param {Object} student_answer  - { answers: { "1": true, "2": false } }
 * @param {Object} correct_answer  - { answers: { "1": true, "2": false, "3": true, "4": false } }
 * @param {number} max_score
 * @returns {number}
 */
const gradeTrueFalse = (student_answer, correct_answer, max_score) => {
  const studentAnswers = student_answer?.answers || {};
  const correctAnswers = correct_answer?.answers || {};
  const total = Object.keys(correctAnswers).length;

  if (total === 0) return 0;

  // Đếm số mệnh đề đúng (đúng với key và value)
  const correctCount = Object.entries(correctAnswers)
    .filter(([id, val]) => studentAnswers[id] === val)
    .length;

  // Bảng tỉ lệ theo số đúng — áp dụng cho đề 4 mệnh đề
  // Có thể điều chỉnh tuỳ cấu trúc đề thi
  const ratioTable = {
    4: [0, 0.10, 0.25, 0.50, 1.00], // index = số mệnh đề đúng
    3: [0, 0.25, 0.50, 1.00],
    2: [0, 0.50, 1.00],
  };

  const ratios = ratioTable[total];
  if (ratios) {
    return parseFloat((ratios[correctCount] * max_score).toFixed(2));
  }

  // Fallback nếu tổng mệnh đề khác bảng: tỉ lệ tuyến tính
  return parseFloat(((correctCount / total) * max_score).toFixed(2));
};

/**
 * Chấm 1 câu trả lời ngắn (short_answer)
 *
 * @param {Object} student_answer  - { text: "12,3" }
 * @param {Object} correct_answer  - { accepted: ["12.3", "12,3"] }
 * @param {number} max_score
 * @returns {number}
 */
const gradeShortAnswer = (student_answer, correct_answer, max_score) => {
  const studentText = student_answer?.text;
  if (studentText === undefined || studentText === null || studentText.toString().trim() === '') return 0;

  const acceptedList = correct_answer?.accepted || [];
  if (acceptedList.length === 0) return 0;

  // Chuẩn hóa: loại khoảng trắng thừa, chuyển thành chữ thường, và đổi dấu phẩy thành dấu chấm
  const normalize = (str) => String(str).trim().toLowerCase().replace(/,/g, '.');

  const normalizedStudent = normalize(studentText);
  
  // So sánh chuỗi đã chuẩn hóa
  for (const accepted of acceptedList) {
    if (normalize(accepted) === normalizedStudent) {
      return max_score;
    }
  }

  return 0;
};

/**
 * Chấm toàn bộ bài nộp (trắc nghiệm + đúng/sai + trả lời ngắn)
 * Câu tự luận (essay) KHÔNG chấm ở đây — do Python NLP service xử lý
 *
 * @param {Array}  examQuestions  - danh sách câu hỏi trong đề: [{ id, type, correct_answer, score }]
 * @param {Array}  answers        - câu trả lời học sinh: [{ question_id, student_answer }]
 * @returns {Array} - [{ question_id, auto_score }]
 */
const gradeSubmission = (examQuestions, answers) => {
  // Map câu trả lời theo question_id để lookup nhanh
  const answerMap = {};
  answers.forEach(a => { answerMap[a.question_id] = a.student_answer; });

  const scores = [];

  for (const q of examQuestions) {
    // Bỏ qua câu tự luận — chờ Python NLP
    if (q.type === 'essay') continue;

    const studentAnswer = answerMap[q.id] || null;
    let score = 0;

    if (studentAnswer) {
      if (q.type === 'multiple_choice') {
        score = gradeMultipleChoice(studentAnswer, q.correct_answer, q.score);
      } else if (q.type === 'true_false') {
        score = gradeTrueFalse(studentAnswer, q.correct_answer, q.score);
      } else if (q.type === 'short_answer') {
        score = gradeShortAnswer(studentAnswer, q.correct_answer, q.score);
      }
    }

    scores.push({ question_id: q.id, auto_score: score });
  }

  return scores;
};

module.exports = { gradeMultipleChoice, gradeTrueFalse, gradeShortAnswer, gradeSubmission };
