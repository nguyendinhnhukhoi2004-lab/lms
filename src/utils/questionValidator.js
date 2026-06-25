// src/utils/questionValidator.js
// Kiểm tra cấu trúc options và correct_answer theo từng dạng câu hỏi
// Tách ra file riêng để tái sử dụng ở controller và test

/**
 * Validate câu hỏi trắc nghiệm (multiple_choice)
 *
 * options mẫu:
 *   [{"id":"A","text":"Nội dung A"}, {"id":"B","text":"Nội dung B"}, ...]
 *
 * correct_answer mẫu:
 *   {"selected": ["A"]}          -- 1 đáp án
 *   {"selected": ["A","C"]}      -- nhiều đáp án
 */
const validateMultipleChoice = (options, correct_answer) => {
  const errors = [];

  if (!Array.isArray(options) || options.length < 2) {
    errors.push('Câu trắc nghiệm cần ít nhất 2 lựa chọn');
  } else {
    // Kiểm tra mỗi lựa chọn phải có id và text
    const ids = options.map(o => o.id);
    const hasInvalidOption = options.some(o => !o.id || !o.text || typeof o.text !== 'string');
    if (hasInvalidOption) {
      errors.push('Mỗi lựa chọn phải có "id" và "text"');
    }

    // Kiểm tra đáp án đúng
    if (!correct_answer?.selected || !Array.isArray(correct_answer.selected)) {
      errors.push('correct_answer phải có dạng {"selected": ["A", ...]}');
    } else if (correct_answer.selected.length === 0) {
      errors.push('Phải có ít nhất 1 đáp án đúng');
    } else {
      const invalidAnswers = correct_answer.selected.filter(a => !ids.includes(a));
      if (invalidAnswers.length > 0) {
        errors.push(`Đáp án [${invalidAnswers.join(', ')}] không tồn tại trong danh sách lựa chọn`);
      }
    }
  }

  return errors;
};

/**
 * Validate câu hỏi đúng/sai (true_false)
 *
 * options mẫu:
 *   [{"id":"1","statement":"Mệnh đề 1"}, {"id":"2","statement":"Mệnh đề 2"}, ...]
 *
 * correct_answer mẫu:
 *   {"answers": {"1": true, "2": false, "3": true, "4": false}}
 */
const validateTrueFalse = (options, correct_answer) => {
  const errors = [];

  if (!Array.isArray(options) || options.length < 2) {
    errors.push('Câu đúng/sai cần ít nhất 2 mệnh đề');
  } else {
    const ids = options.map(o => String(o.id));
    const hasInvalidOption = options.some(o => !o.id || !o.statement || typeof o.statement !== 'string');
    if (hasInvalidOption) {
      errors.push('Mỗi mệnh đề phải có "id" và "statement"');
    }

    if (!correct_answer?.answers || typeof correct_answer.answers !== 'object') {
      errors.push('correct_answer phải có dạng {"answers": {"1": true, "2": false, ...}}');
    } else {
      const answerKeys = Object.keys(correct_answer.answers);

      // Phải có đáp án cho tất cả mệnh đề
      const missingAnswers = ids.filter(id => !answerKeys.includes(id));
      if (missingAnswers.length > 0) {
        errors.push(`Thiếu đáp án cho mệnh đề: [${missingAnswers.join(', ')}]`);
      }

      // Giá trị phải là boolean
      const invalidValues = Object.entries(correct_answer.answers)
        .filter(([, v]) => typeof v !== 'boolean');
      if (invalidValues.length > 0) {
        errors.push('Giá trị đáp án đúng/sai phải là true hoặc false');
      }
    }
  }

  return errors;
};

/**
 * Validate câu hỏi tự luận (essay)
 *
 * options: null (không có lựa chọn)
 *
 * correct_answer mẫu:
 *   {
 *     "sample": "Đáp án mẫu đầy đủ của giáo viên...",
 *     "keywords": ["từ khóa 1", "từ khóa 2"]
 *   }
 */
const validateEssay = (options, correct_answer) => {
  const errors = [];

  if (options !== null && options !== undefined) {
    errors.push('Câu tự luận không có lựa chọn (options phải là null)');
  }

  if (!correct_answer?.sample || typeof correct_answer.sample !== 'string') {
    errors.push('correct_answer phải có "sample" là đáp án mẫu dạng văn bản');
  } else if (correct_answer.sample.trim().length < 10) {
    errors.push('Đáp án mẫu phải có ít nhất 10 ký tự');
  }

  if (!Array.isArray(correct_answer?.keywords) || correct_answer.keywords.length === 0) {
    errors.push('correct_answer phải có "keywords" là mảng từ khóa (ít nhất 1 từ)');
  }

  return errors;
};

/**
 * Validate câu hỏi trả lời ngắn (short_answer)
 *
 * options: null (không có lựa chọn)
 *
 * correct_answer mẫu:
 *   {
 *     "accepted": ["12.3", "12,3", "12"]
 *   }
 */
const validateShortAnswer = (options, correct_answer) => {
  const errors = [];

  if (options !== null && options !== undefined && (!Array.isArray(options) || options.length > 0)) {
    errors.push('Câu hỏi trả lời ngắn không có lựa chọn (options phải để trống hoặc null)');
  }

  if (!correct_answer?.accepted || !Array.isArray(correct_answer.accepted) || correct_answer.accepted.length === 0) {
    errors.push('correct_answer phải chứa "accepted" là một mảng các đáp án hợp lệ (ít nhất 1 đáp án)');
  } else {
    const invalidAnswers = correct_answer.accepted.filter(a => typeof a !== 'string' || a.trim() === '');
    if (invalidAnswers.length > 0) {
      errors.push('Mỗi đáp án trong mảng accepted phải là một chuỗi khác rỗng');
    }
  }

  return errors;
};

// Hàm tổng hợp — gọi từ controller
const validateQuestion = (type, options, correct_answer) => {
  switch (type) {
    case 'multiple_choice': return validateMultipleChoice(options, correct_answer);
    case 'true_false':      return validateTrueFalse(options, correct_answer);
    case 'essay':           return validateEssay(options, correct_answer);
    case 'short_answer':    return validateShortAnswer(options, correct_answer);
    default:                return ['Dạng câu hỏi không hợp lệ'];
  }
};

module.exports = { validateQuestion };
