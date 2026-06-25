// src/utils/nlpService.js
// Giao tiếp với Python Flask NLP service để chấm câu tự luận
// Python service chạy riêng tại NLP_SERVICE_URL (mặc định: http://localhost:5001)

require('dotenv').config();

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:5001';

/**
 * Gọi Python NLP service để tính Cosine Similarity cho 1 câu tự luận
 */
const gradeEssay = async (studentText, sampleText, keywords = [], maxScore = 10) => {
  try {
    const response = await fetch(`${NLP_SERVICE_URL}/grade-essay`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_text: studentText,
        sample_text:  sampleText,
        keywords,
        max_score:    maxScore,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`NLP service trả về lỗi: ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.similarity_score !== 'number' || typeof data.suggested_score !== 'number') {
      throw new Error('NLP service trả về dữ liệu không hợp lệ');
    }
    return {
      similarity_score: parseFloat(data.similarity_score.toFixed(4)),
      auto_score:       parseFloat(data.suggested_score.toFixed(2)),
    };
  } catch (err) {
    console.error('NLP service error (sẽ chấm thủ công):', err.message);
    return { similarity_score: null, auto_score: null };
  }
};

/**
 * FIX: Gọi /grade-batch để chấm nhiều câu tự luận trong 1 request
 * Thay vì gọi N lần /grade-essay, gọi 1 lần /grade-batch — giảm latency đáng kể
 *
 * @param {Array} essays - [{ question_id, student_text, sample_text, keywords, max_score }]
 * @returns {Array}      - [{ question_id, similarity_score, auto_score }]
 */
const gradeEssayBatch = async (essays) => {
  if (!essays || essays.length === 0) return [];

  try {
    const response = await fetch(`${NLP_SERVICE_URL}/grade-batch`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ essays }),
      signal: AbortSignal.timeout(30000), // batch cần timeout dài hơn
    });

    if (!response.ok) {
      throw new Error(`NLP batch service trả về lỗi: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.results)) {
      throw new Error('NLP batch service trả về dữ liệu không hợp lệ');
    }

    return data.results.map(r => ({
      question_id:      r.question_id,
      similarity_score: typeof r.similarity_score === 'number'
        ? parseFloat(r.similarity_score.toFixed(4)) : null,
      auto_score: typeof r.suggested_score === 'number'
        ? parseFloat(r.suggested_score.toFixed(2)) : null,
    }));
  } catch (err) {
    console.error('NLP batch service error:', err.message);
    // Fallback: trả về null cho tất cả để đánh dấu cần chấm thủ công
    return essays.map(e => ({
      question_id:      e.question_id,
      similarity_score: null,
      auto_score:       null,
    }));
  }
};

module.exports = { gradeEssay, gradeEssayBatch };
