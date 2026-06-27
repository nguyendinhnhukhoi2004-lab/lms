// src/utils/questionImporter.js
// Parse file Excel (.xlsx) hoặc Word (.docx) thành mảng câu hỏi chuẩn
// Sau khi parse, mỗi câu được validate bằng questionValidator trước khi lưu DB

const XLSX     = require('xlsx');
const mammoth  = require('mammoth');
const { validateQuestion } = require('./questionValidator');

// ── Hằng số ───────────────────────────────────────────────────────
const VALID_TYPES       = ['multiple_choice', 'true_false', 'essay', 'short_answer'];
// CV 7991/BGDĐT-GDTrH ngày 17/12/2024: 3 mức độ nhận thức (Biết / Hiểu / Vận dụng)
const VALID_DIFFICULTIES = ['nhan_biet', 'thong_hieu', 'van_dung'];

// Map tên tiếng Việt → enum (hỗ trợ giáo viên nhập không đúng chuẩn)
// Giữ các alias cũ (vdc, van_dung_cao) → van_dung để tương thích file Excel cũ
const DIFFICULTY_MAP = {
  // Mức Biết
  'nhan_biet':    'nhan_biet',
  'nhận biết':    'nhan_biet',
  'nhan biet':    'nhan_biet',
  'biết':         'nhan_biet',
  'nb':           'nhan_biet',
  // Mức Hiểu
  'thong_hieu':   'thong_hieu',
  'thông hiểu':   'thong_hieu',
  'thong hieu':   'thong_hieu',
  'hiểu':         'thong_hieu',
  'th':           'thong_hieu',
  // Mức Vận dụng
  'van_dung':     'van_dung',
  'vận dụng':     'van_dung',
  'van dung':     'van_dung',
  'vd':           'van_dung',
  // Alias cũ (tương thích ngược — van_dung_cao gộp vào van_dung theo CV 7991)
  'van_dung_cao': 'van_dung',
  'vận dụng cao': 'van_dung',
  'van dung cao': 'van_dung',
  'vdc':          'van_dung',
};

const TYPE_MAP = {
  'multiple_choice': 'multiple_choice',
  'mcq':             'multiple_choice',
  'trắc nghiệm':     'multiple_choice',
  'trac nghiem':     'multiple_choice',
  'tn':              'multiple_choice',
  'true_false':      'true_false',
  'đúng/sai':        'true_false',
  'dung/sai':        'true_false',
  'ds':              'true_false',
  'essay':           'essay',
  'tự luận':         'essay',
  'tu luan':         'essay',
  'tl':              'essay',
  'short_answer':    'short_answer',
  'trả lời ngắn':    'short_answer',
  'tra loi ngan':    'short_answer',
  'tln':             'short_answer',
};

const normalizeDifficulty = (val) =>
  DIFFICULTY_MAP[(val || '').toString().trim().toLowerCase()] || null;

const normalizeType = (val) =>
  TYPE_MAP[(val || '').toString().trim().toLowerCase()] || null;

// Parse tiền tố Azota trong mệnh đề đúng/sai
// Ví dụ: "[1,NB] Nội dung mệnh đề" → { order: 1, difficulty: 'nhan_biet', cleanStatement: 'Nội dung mệnh đề' }
// Nếu không có tiền tố → { order: null, difficulty: null, cleanStatement: 'Nội dung mệnh đề' }
const parseTrueFalsePrefix = (statementText) => {
  const match = statementText.match(/^\[(\d+)\s*,\s*(NB|TH|VD|VDC|nhan_biet|thong_hieu|van_dung|van_dung_cao)\]/i);
  if (!match) {
    return { order: null, difficulty: null, cleanStatement: statementText.trim() };
  }
  return {
    order:          parseInt(match[1]),
    difficulty:     normalizeDifficulty(match[2]),
    cleanStatement: statementText.slice(match[0].length).trim(),
  };
};

// ── PARSE EXCEL ────────────────────────────────────────────────────
// Format cột (tên cột ở hàng 1):
//   type | difficulty | content | option_a | option_b | option_c | option_d | correct | keywords | sample
//
// Ví dụ MCQ:
//   multiple_choice | nhan_biet | 2+2=? | 3 | 4 | 5 | 6 | B | | 
//
// Ví dụ True/False:
//   true_false | thong_hieu | [Tiêu đề câu] | [Mệnh đề 1] | [Mệnh đề 2] | [Mệnh đề 3] | [Mệnh đề 4] | T,F,T,F | |
//   (correct = chuỗi T/F cách nhau bởi dấu phẩy, theo thứ tự mệnh đề)
//
// Ví dụ Essay:
//   essay | van_dung_cao | Viết chương trình... | | | | | | từ khóa 1,từ khóa 2 | Đáp án mẫu đầy đủ...

const parseExcel = (buffer) => {
  const workbook  = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const questions = [];
  const errors    = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +2 vì hàng 1 là header
    const rawType       = row['type']       || row['Type']       || row['Loại câu'] || '';
    const rawDifficulty = row['difficulty'] || row['Difficulty'] || row['Độ khó']   || '';
    const content       = (row['content']   || row['Content']    || row['Nội dung'] || '').toString().trim();
    const optA          = (row['option_a']  || row['Option A']   || row['Đáp án A'] || '').toString().trim();
    const optB          = (row['option_b']  || row['Option B']   || row['Đáp án B'] || '').toString().trim();
    const optC          = (row['option_c']  || row['Option C']   || row['Đáp án C'] || '').toString().trim();
    const optD          = (row['option_d']  || row['Option D']   || row['Đáp án D'] || '').toString().trim();
    const correct       = (row['correct']   || row['Correct']    || row['Đáp án đúng'] || '').toString().trim();
    const keywords      = (row['keywords']  || row['Keywords']   || row['Từ khóa'] || '').toString().trim();
    const sample        = (row['sample']    || row['Sample']     || row['Đáp án mẫu'] || '').toString().trim();

    // Bỏ qua hàng trống
    if (!rawType && !content) return;

    const type       = normalizeType(rawType);
    const difficulty = normalizeDifficulty(rawDifficulty);

    if (!type) {
      errors.push({ row: rowNum, error: `Loại câu không hợp lệ: "${rawType}". Dùng: mcq / true_false / essay` });
      return;
    }
    if (!difficulty) {
      errors.push({ row: rowNum, error: `Độ khó không hợp lệ: "${rawDifficulty}". Dùng: nhan_biet (Biết) / thong_hieu (Hiểu) / van_dung (Vận dụng)` });
      return;
    }
    if (!content) {
      errors.push({ row: rowNum, error: 'Nội dung câu hỏi không được để trống' });
      return;
    }

    let options        = null;
    let correct_answer = null;

    if (type === 'multiple_choice') {
      const opts = [optA, optB, optC, optD].filter(o => o);
      if (opts.length < 2) {
        errors.push({ row: rowNum, error: 'Câu trắc nghiệm cần ít nhất 2 lựa chọn (option_a, option_b...)' });
        return;
      }
      options = opts.map((text, i) => ({ id: String.fromCharCode(65 + i), text }));

      // correct: "B" hoặc "b" hoặc "A,C" cho nhiều đáp án
      const selectedRaw = correct.toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
      const validIds    = options.map(o => o.id);
      const invalid     = selectedRaw.filter(s => !validIds.includes(s));
      if (selectedRaw.length === 0 || invalid.length > 0) {
        errors.push({ row: rowNum, error: `Đáp án đúng "${correct}" không hợp lệ. Dùng chữ cái A/B/C/D` });
        return;
      }
      correct_answer = { selected: selectedRaw };
    }

    if (type === 'true_false') {
      const stmts = [optA, optB, optC, optD].filter(o => o);
      if (stmts.length < 2) {
        errors.push({ row: rowNum, error: 'Câu đúng/sai cần ít nhất 2 mệnh đề' });
        return;
      }
      options = stmts.map((rawStmt, i) => {
        const { order, difficulty: stmtDifficulty, cleanStatement } = parseTrueFalsePrefix(rawStmt);
        return {
          id:        String(i + 1),
          statement: cleanStatement,
          ...(stmtDifficulty !== null && { difficulty: stmtDifficulty }),
          ...(order !== null           && { order }),
        };
      });

      // correct: "T,F,T,F" hoặc "true,false,true,false" hoặc "1,0,1,0"
      const answerRaw = correct.split(',').map(s => s.trim().toLowerCase());
      if (answerRaw.length !== stmts.length) {
        errors.push({ row: rowNum, error: `Số đáp án (${answerRaw.length}) không khớp số mệnh đề (${stmts.length})` });
        return;
      }
      const answers = {};
      for (let i = 0; i < stmts.length; i++) {
        const v = answerRaw[i];
        if (['t', 'true', '1', 'đúng', 'dung'].includes(v)) {
          answers[String(i + 1)] = true;
        } else if (['f', 'false', '0', 'sai'].includes(v)) {
          answers[String(i + 1)] = false;
        } else {
          errors.push({ row: rowNum, error: `Đáp án mệnh đề ${i+1} không hợp lệ: "${v}". Dùng T/F hoặc true/false` });
          return;
        }
      }
      correct_answer = { answers };
    }

    if (type === 'essay') {
      if (!sample) {
        errors.push({ row: rowNum, error: 'Câu tự luận cần có đáp án mẫu (cột sample)' });
        return;
      }
      const kws = keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : [];
      if (kws.length === 0) {
        errors.push({ row: rowNum, error: 'Câu tự luận cần ít nhất 1 từ khóa (cột keywords)' });
        return;
      }
      options        = null;
      correct_answer = { sample, keywords: kws };
    }

    if (type === 'short_answer') {
      if (!correct) {
        errors.push({ row: rowNum, error: 'Câu trả lời ngắn cần có đáp án (cột correct)' });
        return;
      }
      options = null;
      correct_answer = {
        accepted: correct.split(',').map(s => s.trim()).filter(Boolean),
      };
    }

    // Validate lại bằng questionValidator
    const valErrors = validateQuestion(type, options, correct_answer);
    if (valErrors.length > 0) {
      errors.push({ row: rowNum, error: valErrors.join('; ') });
      return;
    }

    questions.push({ type, difficulty, content, options, correct_answer });
  });

  return { questions, errors };
};

// ── PARSE WORD ─────────────────────────────────────────────────────
// Format quy ước trong file .docx:
//
// Câu 1: [MCQ] [NB]
// Nội dung câu hỏi đầy đủ?
// A. Lựa chọn A
// B. Lựa chọn B
// C. Lựa chọn C
// D. Lựa chọn D
// Đáp án: B
//
// Câu 2: [DS] [TH]
// Tiêu đề câu đúng/sai (tùy chọn)
// a) Mệnh đề 1
// b) Mệnh đề 2
// c) Mệnh đề 3
// d) Mệnh đề 4
// Đáp án: T,F,T,F
//
// Câu 3: [TL] [VDC]
// Nội dung câu tự luận...
// Từ khóa: từ khóa 1, từ khóa 2
// Đáp án mẫu: Đáp án mẫu đầy đủ...

const parseWord = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  const text   = result.value;
  const lines  = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const questions = [];
  const errors    = [];

  // Tách các block câu hỏi theo dòng "Câu N:" hoặc "Cau N:"
  const blockStarts = [];
  lines.forEach((line, i) => {
    if (/^(câu|cau)\s*\d+\s*:/i.test(line)) blockStarts.push(i);
  });

  if (blockStarts.length === 0) {
    return {
      questions: [],
      errors: [{ row: 0, error: 'Không tìm thấy câu hỏi nào. File phải có dòng "Câu 1: [MCQ] [NB]" ở đầu mỗi câu.' }],
    };
  }

  blockStarts.forEach((start, bi) => {
    const end        = bi < blockStarts.length - 1 ? blockStarts[bi + 1] : lines.length;
    const block      = lines.slice(start, end);
    const headerLine = block[0]; // "Câu 1: [MCQ] [NB]"
    const qNum       = bi + 1;

    // Parse header — lấy type và difficulty
    const typeMatch  = headerLine.match(/\[(MCQ|TN|DS|TL|TLN|multiple_choice|true_false|essay|short_answer)\]/i);
    // VDC vẫn nhận nhưng được map → van_dung (tương thích file .docx cũ)
    const diffMatch  = headerLine.match(/\[(NB|TH|VD|VDC|nhan_biet|thong_hieu|van_dung|van_dung_cao)\]/i);

    if (!typeMatch) {
      errors.push({ row: qNum, error: `Câu ${qNum}: Thiếu loại câu trong header. VD: [MCQ] hoặc [DS]` });
      return;
    }
    if (!diffMatch) {
      errors.push({ row: qNum, error: `Câu ${qNum}: Thiếu độ khó trong header. VD: [NB] hoặc [TH]` });
      return;
    }

    const type       = normalizeType(typeMatch[1]);
    const difficulty = normalizeDifficulty(diffMatch[1]);

    if (!type || !difficulty) {
      errors.push({ row: qNum, error: `Câu ${qNum}: Loại câu hoặc độ khó không hợp lệ` });
      return;
    }

    const bodyLines = block.slice(1); // bỏ dòng header

    let options        = null;
    let correct_answer = null;
    let content        = '';

    if (type === 'multiple_choice') {
      // Dòng đáp án: /^Đáp án:|^DA:|^Dap an:/i
      const answerLineIdx = bodyLines.findIndex(l => /^(đáp án|da|dap an)\s*:/i.test(l));
      if (answerLineIdx === -1) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Thiếu dòng "Đáp án: B"` });
        return;
      }

      // Dòng lựa chọn: /^[A-D]\./  hoặc /^[A-D]\)/
      const optLines  = bodyLines.filter(l => /^[A-D][.)]\s+/i.test(l));
      const contentLines = bodyLines.filter(
        (l, i) => i < answerLineIdx && !/^[A-D][.)]\s+/i.test(l)
      );
      content = contentLines.join(' ').trim();

      if (optLines.length < 2) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Cần ít nhất 2 lựa chọn A/B/C/D` });
        return;
      }
      options = optLines.map((l) => {
        const id   = l[0].toUpperCase();
        const text = l.replace(/^[A-D][.)]\s+/i, '').trim();
        return { id, text };
      });

      const answerRaw = bodyLines[answerLineIdx]
        .replace(/^(đáp án|da|dap an)\s*:/i, '').trim().toUpperCase();
      const selected  = answerRaw.split(',').map(s => s.trim()).filter(Boolean);
      const validIds  = options.map(o => o.id);
      const invalid   = selected.filter(s => !validIds.includes(s));
      if (selected.length === 0 || invalid.length > 0) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Đáp án "${answerRaw}" không hợp lệ` });
        return;
      }
      correct_answer = { selected };
    }

    if (type === 'true_false') {
      const answerLineIdx = bodyLines.findIndex(l => /^(đáp án|da|dap an)\s*:/i.test(l));
      if (answerLineIdx === -1) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Thiếu dòng "Đáp án: T,F,T,F"` });
        return;
      }

      // Mệnh đề: dòng bắt đầu bằng a)/b)/c)/d) hoặc 1./2./3./4.
      const stmtLines = bodyLines.filter(l => /^[a-d][.)]\s+/i.test(l) || /^[1-4][.)]\s+/i.test(l));
      const contentLines = bodyLines.filter(
        (l, i) => i < answerLineIdx && !/^[a-d][.)]\s+/i.test(l) && !/^[1-4][.)]\s+/i.test(l)
      );
      content = contentLines.join(' ').trim();

      if (stmtLines.length < 2) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Cần ít nhất 2 mệnh đề (a)/b)/c)/d))` });
        return;
      }
      options = stmtLines.map((l, i) => {
        const rawStatement = l.replace(/^[a-d1-4][.)]\s+/i, '').trim();
        const { order, difficulty: stmtDifficulty, cleanStatement } = parseTrueFalsePrefix(rawStatement);
        return {
          id:        String(i + 1),
          statement: cleanStatement,
          ...(stmtDifficulty !== null && { difficulty: stmtDifficulty }),
          ...(order !== null           && { order }),
        };
      });

      const answerRaw = bodyLines[answerLineIdx]
        .replace(/^(đáp án|da|dap an)\s*:/i, '').trim();
      const parts     = answerRaw.split(',').map(s => s.trim().toLowerCase());
      if (parts.length !== stmtLines.length) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Số đáp án (${parts.length}) ≠ số mệnh đề (${stmtLines.length})` });
        return;
      }
      const answers = {};
      for (let i = 0; i < parts.length; i++) {
        const v = parts[i];
        if (['t', 'true', '1', 'đúng', 'dung'].includes(v))       answers[String(i+1)] = true;
        else if (['f', 'false', '0', 'sai'].includes(v))           answers[String(i+1)] = false;
        else {
          errors.push({ row: qNum, error: `Câu ${qNum}: Đáp án mệnh đề ${i+1} không hợp lệ: "${v}"` });
          return;
        }
      }
      correct_answer = { answers };
    }

    if (type === 'essay') {
      const kwLineIdx = bodyLines.findIndex(l => /^(từ khóa|tu khoa|keywords?)\s*:/i.test(l));
      const smLineIdx = bodyLines.findIndex(l => /^(đáp án mẫu|dap an mau|sample)\s*:/i.test(l));

      if (kwLineIdx === -1) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Thiếu dòng "Từ khóa: kw1, kw2"` });
        return;
      }
      if (smLineIdx === -1) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Thiếu dòng "Đáp án mẫu: ..."` });
        return;
      }

      const contentLines = bodyLines.filter((_, i) => i < Math.min(kwLineIdx, smLineIdx));
      content = contentLines.join(' ').trim();

      const kwRaw  = bodyLines[kwLineIdx].replace(/^(từ khóa|tu khoa|keywords?)\s*:/i, '').trim();
      const sample = bodyLines[smLineIdx].replace(/^(đáp án mẫu|dap an mau|sample)\s*:/i, '').trim();
      const kws    = kwRaw.split(',').map(k => k.trim()).filter(Boolean);

      if (!sample) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Đáp án mẫu không được để trống` });
        return;
      }
      options        = null;
      correct_answer = { sample, keywords: kws };
    }

    if (type === 'short_answer') {
      const answerLineIdx = bodyLines.findIndex(l => /^(đáp án|da|dap an)\s*:/i.test(l));
      if (answerLineIdx === -1) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Thiếu dòng "Đáp án: ..."` });
        return;
      }

      const contentLines = bodyLines.filter((_, i) => i < answerLineIdx);
      content = contentLines.join(' ').trim();

      const answerRaw = bodyLines[answerLineIdx].replace(/^(đáp án|da|dap an)\s*:/i, '').trim();
      if (!answerRaw) {
        errors.push({ row: qNum, error: `Câu ${qNum}: Đáp án không được để trống` });
        return;
      }

      options = null;
      correct_answer = {
        accepted: answerRaw.split(',').map(s => s.trim()).filter(Boolean),
      };
    }

    if (!content) {
      errors.push({ row: qNum, error: `Câu ${qNum}: Không tìm được nội dung câu hỏi` });
      return;
    }

    const valErrors = validateQuestion(type, options, correct_answer);
    if (valErrors.length > 0) {
      errors.push({ row: qNum, error: `Câu ${qNum}: ${valErrors.join('; ')}` });
      return;
    }

    questions.push({ type, difficulty, content, options, correct_answer });
  });

  return { questions, errors };
};

// ── Export ─────────────────────────────────────────────────────────
module.exports = { parseExcel, parseWord };
