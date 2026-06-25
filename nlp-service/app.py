# nlp-service/app.py
# Flask server nhận bài tự luận từ Node.js, trả điểm gợi ý
# Chạy độc lập tại cổng 5001

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from preprocessor import preprocess, preprocess_keywords
from scorer import (
    compute_tfidf_similarity,
    compute_keyword_coverage,
    compute_final_score,
)
from llm_scorer import grade_with_gemini

load_dotenv()

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000'])  # chỉ cho phép Node.js backend gọi


# ── Health check ─────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'nlp-grader'})


# ── Endpoint chấm tự luận ─────────────────────────────────────────
@app.route('/grade-essay', methods=['POST'])
def grade_essay():
    """
    Nhận bài tự luận của học sinh và đáp án mẫu, trả về:
      - similarity_score: độ tương đồng TF-IDF Cosine (0.0 – 1.0)
      - keyword_coverage: tỉ lệ từ khóa có trong bài (0.0 – 1.0)
      - suggested_score:  điểm gợi ý cho giáo viên

    Request body (JSON):
    {
        "student_text": "Hình tượng người lính trong bài thơ Đồng chí...",
        "sample_text":  "Đáp án mẫu của giáo viên...",
        "keywords":     ["người lính", "đồng chí", "tình đồng đội"],
        "max_score":    2.0
    }

    Response:
    {
        "similarity_score": 0.7243,
        "keyword_coverage": 0.6667,
        "suggested_score":  1.21,
        "detail": {
            "student_length": 120,
            "sample_length":  350,
            "keywords_found": ["người_lính", "đồng_chí"],
            "keywords_total": 3
        }
    }
    """
    data = request.get_json(silent=True)

    # Validate đầu vào
    if not data:
        return jsonify({'error': 'Body phải là JSON'}), 400

    student_text = data.get('student_text', '')
    sample_text  = data.get('sample_text',  '')
    keywords     = data.get('keywords',     [])
    max_score    = float(data.get('max_score', 10.0))

    if not sample_text:
        return jsonify({'error': 'sample_text không được để trống'}), 400

    if max_score <= 0:
        return jsonify({'error': 'max_score phải > 0'}), 400

    # ── Tiền xử lý ───────────────────────────────────────────────
    student_processed  = preprocess(student_text)
    sample_processed   = preprocess(sample_text)
    processed_keywords = preprocess_keywords(keywords)

    # ── Bài trống sau xử lý → 0 điểm ────────────────────────────
    if not student_processed:
        return jsonify({
            'similarity_score': 0.0,
            'keyword_coverage': 0.0,
            'suggested_score':  0.0,
            'detail': {
                'student_length': 0,
                'sample_length':  len(sample_processed.split()),
                'keywords_found': [],
                'keywords_total': len(processed_keywords),
                'note': 'Bài làm trống hoặc không có nội dung hợp lệ',
            }
        })

    # ── Tính điểm (Mô hình Hybrid) ───────────────────────────────
    similarity_score = compute_tfidf_similarity(student_processed, sample_processed)
    keyword_coverage = compute_keyword_coverage(student_processed, processed_keywords)
    
    note_msg = None
    
    # Nếu giống hệt đáp án mẫu -> cho full điểm luôn (đỡ tốn tiền gọi AI)
    if similarity_score >= 0.92:
        suggested_score = max_score
        note_msg = "Full điểm do trùng khớp rất cao với đáp án mẫu (TF-IDF >= 0.92)"
    else:
        # Nếu điểm chưa tối đa, gọi Gemini AI để chấm theo ngữ nghĩa
        ai_result = grade_with_gemini(student_text, sample_text, keywords, max_score)
        
        if "error" not in ai_result:
            suggested_score = ai_result["score"]
            note_msg = f"Đánh giá bởi AI: {ai_result['note']}"
        else:
            # Fallback về thuật toán cũ nếu AI bị lỗi (rớt mạng, chưa có API Key...)
            suggested_score = compute_final_score(
                similarity_score, keyword_coverage, max_score,
                student_processed, sample_processed
            )
            note_msg = f"Điểm theo thuật toán cơ bản (Fallback). Lỗi AI: {ai_result.get('error', '')}"

    # Tìm từ khóa nào có trong bài (để giáo viên tham khảo)
    keywords_found = [
        kw for kw in processed_keywords
        if kw and kw in student_processed
    ]

    # Tính length_ratio để trả về trong detail
    from scorer import compute_length_ratio
    length_ratio = compute_length_ratio(student_processed, sample_processed)

    return jsonify({
        'similarity_score': similarity_score,
        'keyword_coverage': keyword_coverage,
        'suggested_score':  suggested_score,
        'detail': {
            'student_length': len(student_processed.split()),
            'sample_length':  len(sample_processed.split()),
            'length_ratio':   length_ratio,
            'keywords_found': keywords_found,
            'keywords_total': len(processed_keywords),
            'note': note_msg,
        }
    })


# ── Endpoint kiểm tra tiền xử lý (dành cho debug) ────────────────
@app.route('/preprocess', methods=['POST'])
def debug_preprocess():
    """
    Debug endpoint: xem văn bản sau khi tiền xử lý
    Dùng để kiểm tra underthesea tách từ đúng không

    Request: { "text": "Hình tượng người lính trong bài thơ..." }
    Response: { "original": "...", "processed": "người_lính đồng_chí ..." }
    """
    data = request.get_json(silent=True)
    if not data or 'text' not in data:
        return jsonify({'error': 'Thiếu trường text'}), 400

    processed = preprocess(data['text'])
    return jsonify({
        'original':  data['text'],
        'processed': processed,
        'tokens':    processed.split(),
        'count':     len(processed.split()),
    })


# ── Endpoint batch chấm nhiều câu cùng lúc ───────────────────────
@app.route('/grade-batch', methods=['POST'])
def grade_batch():
    """
    Chấm nhiều câu tự luận trong 1 request — dùng khi cần chấm toàn bộ
    bài thi có nhiều câu tự luận mà không gọi nhiều request liên tiếp.

    Request:
    {
        "essays": [
            {
                "question_id": "uuid-1",
                "student_text": "...",
                "sample_text":  "...",
                "keywords":     [...],
                "max_score":    2.0
            },
            ...
        ]
    }

    Response:
    {
        "results": [
            { "question_id": "uuid-1", "similarity_score": 0.72, "suggested_score": 1.2 },
            ...
        ]
    }
    """
    data = request.get_json(silent=True)
    if not data or 'essays' not in data:
        return jsonify({'error': 'Thiếu trường essays'}), 400

    results = []
    for essay in data['essays']:
        question_id  = essay.get('question_id', '')
        student_text = essay.get('student_text', '')
        sample_text  = essay.get('sample_text',  '')
        keywords     = essay.get('keywords',     [])
        max_score    = float(essay.get('max_score', 10.0))

        student_proc  = preprocess(student_text)
        sample_proc   = preprocess(sample_text)
        proc_keywords = preprocess_keywords(keywords)

        if not student_proc:
            results.append({
                'question_id':     question_id,
                'similarity_score': 0.0,
                'keyword_coverage': 0.0,
                'suggested_score':  0.0,
            })
            continue

        similarity = compute_tfidf_similarity(student_proc, sample_proc)
        coverage   = compute_keyword_coverage(student_proc, proc_keywords)
        
        if similarity >= 0.92:
            score = max_score
            note = "Trùng khớp cao (TF-IDF >= 0.92)"
        else:
            ai_result = grade_with_gemini(student_text, sample_text, keywords, max_score)
            if "error" not in ai_result:
                score = ai_result["score"]
                note = f"AI: {ai_result['note']}"
            else:
                score = compute_final_score(
                    similarity, coverage, max_score,
                    student_proc, sample_proc
                )
                note = f"Cơ bản (Fallback). Lỗi AI: {ai_result.get('error', '')}"

        results.append({
            'question_id':     question_id,
            'similarity_score': similarity,
            'keyword_coverage': coverage,
            'suggested_score':  score,
            'note':             note,
        })

    return jsonify({'results': results})


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    print(f'[NLP] NLP Service khoi dong tai http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=True)
