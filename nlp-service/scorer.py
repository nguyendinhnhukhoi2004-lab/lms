# nlp-service/scorer.py
# Tính điểm bài tự luận bằng 3 thành phần:
#   1. TF-IDF Cosine Similarity  — đo độ tương đồng nội dung tổng thể (trọng số 60%)
#   2. Keyword Coverage          — đo tỉ lệ từ khóa quan trọng có trong bài (trọng số 30%)
#   3. Length Ratio              — khuyến khích bài đủ độ dài so với đáp án mẫu (trọng số 10%)
#
# Điểm cuối = SIMILARITY_WEIGHT × similarity
#           + KEYWORD_WEIGHT    × keyword_coverage
#           + LENGTH_WEIGHT     × length_ratio
#
# ── Điểm đặc biệt ─────────────────────────────────────────────────
# Nếu similarity ≥ FULL_SCORE_THRESHOLD (mặc định 0.92):
#   → Cho full điểm ngay, không cần tính thêm (bài gần giống đáp án mẫu)
# Nếu similarity ≥ HIGH_SCORE_THRESHOLD (mặc định 0.75):
#   → Tăng trọng số similarity lên, giảm yêu cầu từ khóa
#   → Tránh trường hợp bài tốt bị trừ điểm do thiếu đúng từ khóa

import os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

# ── Làm tròn điểm lên bội số 0.25 gần nhất ───────────────────────
# Ví dụ: 1.67 → 1.75 | 1.30 → 1.50 | 1.13 → 1.25
import math

def round_up_to_quarter(score: float) -> float:
    """
    Làm tròn điểm LÊN bội số 0.25 gần nhất.
    Phù hợp thang điểm THPT: 0 / 0.25 / 0.50 / 0.75 / 1.00 / 1.25 / ...

    Ví dụ:
        1.67 → 1.75
        1.30 → 1.50
        1.13 → 1.25
        2.00 → 2.00 (giữ nguyên nếu đã là bội số 0.25)
        0.05 → 0.25 (tối thiểu 0.25 nếu có điểm)
    """
    if score <= 0:
        return 0.0
    # Chia cho 0.25, làm tròn lên (ceiling), nhân lại
    return math.ceil(score / 0.25) * 0.25


# Trọng số — đọc từ .env hoặc dùng mặc định
SIMILARITY_WEIGHT    = float(os.getenv('SIMILARITY_WEIGHT',        0.60))
KEYWORD_WEIGHT       = float(os.getenv('KEYWORD_WEIGHT',           0.30))
LENGTH_WEIGHT        = float(os.getenv('LENGTH_WEIGHT',            0.10))
MIN_SIMILARITY       = float(os.getenv('MIN_SIMILARITY_THRESHOLD', 0.05))

# Ngưỡng full điểm — bài trùng gần hoàn toàn với đáp án mẫu
FULL_SCORE_THRESHOLD = float(os.getenv('FULL_SCORE_THRESHOLD', 0.92))

# Ngưỡng điểm cao — tăng trọng số similarity, giảm yêu cầu từ khóa
HIGH_SCORE_THRESHOLD = float(os.getenv('HIGH_SCORE_THRESHOLD', 0.75))


def compute_tfidf_similarity(student_processed: str, sample_processed: str) -> float:
    """
    Tính Cosine Similarity giữa bài tự luận và đáp án mẫu
    sử dụng TF-IDF vectorization.

    Cải tiến so với phiên bản cũ:
    - Thêm ngưỡng tối thiểu min_df=1
    - Dùng unigram + bigram (1,2) để bắt cụm từ
    - sublinear_tf=True: log(tf) giảm ảnh hưởng từ lặp nhiều
    - smooth_idf=True: tránh chia 0 với từ hiếm

    Returns: float trong [0.0, 1.0]
    """
    if not student_processed.strip() or not sample_processed.strip():
        return 0.0

    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            sublinear_tf=True,
            smooth_idf=True,
        )
        tfidf_matrix = vectorizer.fit_transform([student_processed, sample_processed])
        similarity   = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return float(round(similarity, 4))
    except Exception as e:
        print(f"[scorer] TF-IDF error: {e}")
        return 0.0


def compute_keyword_coverage(student_processed: str, processed_keywords: list) -> float:
    """
    Tính tỉ lệ từ khóa quan trọng xuất hiện trong bài học sinh.

    Cải tiến: partial match — nếu từ khóa là cụm nhiều từ thì
    tính điểm một phần nếu một số từ trong cụm có mặt trong bài.

    Returns: float trong [0.0, 1.0]
    """
    if not processed_keywords:
        return 1.0  # Không có từ khóa → không trừ điểm phần này

    if not student_processed.strip():
        return 0.0

    student_words = set(student_processed.split())
    total_score   = 0.0

    for kw in processed_keywords:
        if not kw:
            continue
        kw_parts = kw.split('_') if '_' in kw else kw.split()

        if kw in student_processed:
            # Khớp hoàn toàn cụm từ
            total_score += 1.0
        elif len(kw_parts) > 1:
            # Partial match: tính theo số từ con có trong bài
            matched = sum(1 for part in kw_parts if part in student_words)
            total_score += matched / len(kw_parts) * 0.6  # partial chỉ tính 60%
        # Không khớp gì → 0

    return round(min(total_score / len(processed_keywords), 1.0), 4)


def compute_length_ratio(student_processed: str, sample_processed: str) -> float:
    """
    Tính tỉ lệ độ dài bài học sinh so với đáp án mẫu.
    Khuyến khích học sinh viết đủ ý, tránh bài quá ngắn.

    Giới hạn tối đa 1.0 — bài dài hơn không được cộng thêm.
    Tối thiểu cần đạt 30% độ dài đáp án mẫu để tính điểm phần này.

    Returns: float trong [0.0, 1.0]
    """
    student_len = len(student_processed.split())
    sample_len  = len(sample_processed.split())

    if sample_len == 0:
        return 1.0

    ratio = student_len / sample_len
    # Chuẩn hóa: bài dài bằng 70% đáp án mẫu trở lên → full điểm phần này
    normalized = min(ratio / 0.7, 1.0)
    return round(normalized, 4)


def compute_final_score(
    similarity_score: float,
    keyword_coverage: float,
    max_score: float,
    student_processed: str = '',
    sample_processed: str  = '',
) -> float:
    """
    Tính điểm cuối từ 3 thành phần với các quy tắc đặc biệt:

    Quy tắc 1 — Full điểm: nếu similarity ≥ FULL_SCORE_THRESHOLD (0.92)
        → trả về max_score ngay (bài gần giống đáp án mẫu)
        → Giải quyết vấn đề: bài trùng đáp án mẫu vẫn không được full điểm

    Quy tắc 2 — Điểm cao: nếu similarity ≥ HIGH_SCORE_THRESHOLD (0.75)
        → tăng trọng số similarity, đảm bảo điểm tối thiểu 75%
        → Tránh bài tốt bị kéo xuống do thiếu từ khóa

    Quy tắc 3 — Bình thường: kết hợp 3 thành phần theo trọng số

    Returns: float (làm tròn 2 chữ số thập phân)
    """
    # Bài không liên quan → 0 điểm
    if similarity_score < MIN_SIMILARITY:
        return 0.0

    # ── Quy tắc 1: Gần giống đáp án mẫu → full điểm ─────────────
    if similarity_score >= FULL_SCORE_THRESHOLD:
        return round_up_to_quarter(max_score)

    # ── Quy tắc 2: Similarity cao → ưu tiên similarity ────────────
    if similarity_score >= HIGH_SCORE_THRESHOLD:
        # Tăng trọng số similarity lên 80%, keyword xuống 20%
        combined = 0.80 * similarity_score + 0.20 * keyword_coverage
        # Đảm bảo điểm tối thiểu 75% max_score khi similarity ≥ HIGH_SCORE_THRESHOLD
        min_score = 0.75 * max_score
        result    = max(combined * max_score, min_score)
        # Không vượt quá 95% max_score (dành phần còn lại cho quy tắc 1)
        return round_up_to_quarter(min(result, 0.95 * max_score))

    # ── Quy tắc 3: Tính điểm bình thường (3 thành phần) ──────────
    length_ratio = compute_length_ratio(student_processed, sample_processed)

    combined = (
        SIMILARITY_WEIGHT * similarity_score
      + KEYWORD_WEIGHT    * keyword_coverage
      + LENGTH_WEIGHT     * length_ratio
    )
    combined = max(0.0, min(1.0, combined))
    return round_up_to_quarter(combined * max_score)
