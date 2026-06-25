# nlp-service/test_scorer.py
# Chạy: python test_scorer.py
# Test toàn bộ pipeline: tiền xử lý → TF-IDF → tính điểm

import sys
import json

from preprocessor import preprocess, preprocess_keywords
from scorer import (
    compute_tfidf_similarity,
    compute_keyword_coverage,
    compute_final_score,
)

# ── Màu sắc terminal ──────────────────────────────────────────────
GREEN  = '\033[92m'
RED    = '\033[91m'
YELLOW = '\033[93m'
RESET  = '\033[0m'
BOLD   = '\033[1m'

passed = 0
failed = 0

def test(name, condition, detail=''):
    global passed, failed
    if condition:
        print(f'{GREEN}✓ PASS{RESET} {name}')
        passed += 1
    else:
        print(f'{RED}✗ FAIL{RESET} {name}')
        if detail:
            print(f'       {YELLOW}→ {detail}{RESET}')
        failed += 1

def section(title):
    print(f'\n{BOLD}── {title} ──{RESET}')


# ============================================================
# TEST 1: TIỀN XỬ LÝ
# ============================================================
section('Tiền xử lý văn bản')

result = preprocess("Hình tượng người lính trong bài thơ Đồng chí của Chính Hữu")
test("Lowercase", result == result.lower(), f"got: {result}")
test("Tách từ ghép tiếng Việt", '_' in result or ' ' in result, f"got: {result}")
test("Bỏ stopwords phổ biến 'trong', 'của'",
     'trong' not in result.split() and 'của' not in result.split(),
     f"got: {result}")

result_empty = preprocess("")
test("Văn bản rỗng trả về chuỗi rỗng", result_empty == "", f"got: '{result_empty}'")

result_noise = preprocess("https://example.com 123 !!! ???")
test("Bỏ URL và số và ký tự đặc biệt", result_noise.strip() == "", f"got: '{result_noise}'")

# ============================================================
# TEST 2: COSINE SIMILARITY
# ============================================================
section('TF-IDF Cosine Similarity')

sample = preprocess(
    "Hình tượng người lính trong bài thơ Đồng chí hiện lên với vẻ đẹp bình dị. "
    "Họ là những người nông dân mặc áo lính, mang theo tình đồng đội sâu sắc. "
    "Chính Hữu đã khắc họa tình cảm chân thật giữa những người lính trong chiến tranh."
)

# Bài tốt — nội dung tương tự
student_good = preprocess(
    "Trong bài thơ Đồng chí, Chính Hữu xây dựng hình tượng người lính rất bình dị. "
    "Người lính xuất thân từ nông thôn, tình đồng đội gắn bó keo sơn. "
    "Bài thơ ca ngợi tình cảm chân thành trong cuộc kháng chiến."
)

# Bài kém — nội dung lạc chủ đề
student_poor = preprocess(
    "Toán học là môn học quan trọng. Phương trình bậc hai có hai nghiệm thực."
)

sim_good = compute_tfidf_similarity(student_good, sample)
sim_poor = compute_tfidf_similarity(student_poor, sample)
sim_empty = compute_tfidf_similarity("", sample)
sim_identical = compute_tfidf_similarity(sample, sample)

print(f'       [Bài tốt]    similarity = {sim_good:.4f}')
print(f'       [Bài kém]    similarity = {sim_poor:.4f}')
print(f'       [Giống hệt]  similarity = {sim_identical:.4f}')

test("Bài tốt có similarity > 0.3",   sim_good > 0.3,    f"got: {sim_good:.4f}")
test("Bài kém có similarity < bài tốt", sim_poor < sim_good, f"poor={sim_poor:.4f}, good={sim_good:.4f}")
test("Bài rỗng → similarity = 0.0",   sim_empty == 0.0,  f"got: {sim_empty}")
test("Bài giống hệt → similarity ≈ 1", sim_identical > 0.99, f"got: {sim_identical:.4f}")

# ============================================================
# TEST 3: KEYWORD COVERAGE
# ============================================================
section('Keyword Coverage')

keywords = ["người lính", "đồng chí", "tình đồng đội", "chiến tranh", "bình dị"]
processed_kw = preprocess_keywords(keywords)

cov_good  = compute_keyword_coverage(student_good, processed_kw)
cov_poor  = compute_keyword_coverage(student_poor, processed_kw)
cov_empty = compute_keyword_coverage("", processed_kw)
cov_no_kw = compute_keyword_coverage(student_good, [])

print(f'       [Bài tốt]    coverage = {cov_good:.4f}')
print(f'       [Bài kém]    coverage = {cov_poor:.4f}')
print(f'       [Không có keyword] coverage = {cov_no_kw:.4f}')

test("Bài tốt có coverage > 0.4",         cov_good > 0.4,   f"got: {cov_good:.4f}")
test("Bài kém có coverage thấp hơn bài tốt", cov_poor < cov_good, f"poor={cov_poor:.4f}")
test("Bài rỗng → coverage = 0.0",          cov_empty == 0.0, f"got: {cov_empty}")
test("Không có keyword → coverage = 1.0",  cov_no_kw == 1.0, f"got: {cov_no_kw}")

# ============================================================
# TEST 4: ĐIỂM CUỐI CÙNG
# ============================================================
section('Điểm cuối cùng (max_score = 2.0)')

max_score = 2.0

score_good = compute_final_score(sim_good, cov_good, max_score)
score_poor = compute_final_score(sim_poor, cov_poor, max_score)
score_zero = compute_final_score(0.0, 0.0, max_score)  # similarity = 0 → 0 điểm

print(f'       [Bài tốt]    điểm = {score_good}/{max_score}')
print(f'       [Bài kém]    điểm = {score_poor}/{max_score}')
print(f'       [similarity=0] điểm = {score_zero}/{max_score}')

test("Bài tốt có điểm > 0",          score_good > 0,           f"got: {score_good}")
test("Bài tốt có điểm > bài kém",    score_good > score_poor,  f"good={score_good}, poor={score_poor}")
test("similarity=0 → 0 điểm",        score_zero == 0.0,        f"got: {score_zero}")
test("Điểm không vượt max_score",     score_good <= max_score,  f"got: {score_good}")
test("Điểm là số thực 2 chữ số",
     isinstance(score_good, float) and len(str(score_good).split('.')[-1]) <= 2,
     f"got: {score_good}")

# ============================================================
# KẾT QUẢ
# ============================================================
total = passed + failed
print(f'\n{BOLD}Kết quả: {GREEN}{passed}{RESET}{BOLD}/{total} test passed{RESET}')
if failed > 0:
    print(f'{RED}         {failed}/{total} test FAILED{RESET}')
    sys.exit(1)
else:
    print(f'{GREEN}Tất cả test đều pass! ✓{RESET}')
