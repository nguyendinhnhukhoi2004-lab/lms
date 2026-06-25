# nlp-service/preprocessor.py
# Tiền xử lý văn bản tiếng Việt trước khi đưa vào TF-IDF
# Pipeline: lowercase → bỏ ký tự đặc biệt → tách từ → bỏ stopwords

import re
from underthesea import word_tokenize

# Danh sách stopwords tiếng Việt phổ biến
# Mở rộng thêm nếu cần thiết cho từng môn học
STOPWORDS = {
    # Đại từ
    "tôi", "bạn", "anh", "chị", "ông", "bà", "họ", "chúng", "mình",
    "ta", "nó", "đây", "đó", "kia",
    # Liên từ / hư từ
    "và", "hoặc", "nhưng", "mà", "vì", "nên", "nếu", "thì", "khi",
    "tuy", "dù", "để", "hay", "với", "về", "của", "cho", "trong",
    "trên", "dưới", "từ", "đến", "tại", "bởi", "theo", "qua",
    # Phó từ / trạng từ
    "đã", "đang", "sẽ", "vẫn", "cũng", "còn", "rất", "quá", "hơn",
    "nhất", "thêm", "nữa", "luôn", "lại", "cứ", "mới",
    # Từ chỉ mức độ / phủ định
    "không", "chẳng", "chưa", "chính", "ngay", "đúng", "thật",
    # Câu hỏi
    "gì", "ai", "nào", "sao", "thế", "bao", "nhiêu", "mấy",
    # Khác
    "là", "có", "được", "bị", "làm", "ra", "vào", "lên", "xuống",
    "này", "như", "những", "các", "một", "hai", "ba",
}


def preprocess(text: str) -> str:
    """
    Tiền xử lý văn bản tiếng Việt.

    Bước 1: Chuẩn hóa — lowercase, bỏ ký tự thừa
    Bước 2: Tách từ tiếng Việt bằng underthesea
    Bước 3: Bỏ stopwords và từ quá ngắn

    Args:
        text: Văn bản thô (bài làm học sinh hoặc đáp án mẫu)

    Returns:
        Chuỗi các từ đã xử lý, nối bằng dấu cách
        Ví dụ: "người lính đồng đội chiến tranh bình dị"
    """
    if not text or not text.strip():
        return ""

    # Bước 1: Chuẩn hóa
    text = text.lower().strip()

    # Bỏ URL
    text = re.sub(r'https?://\S+', '', text)

    # Bỏ ký tự đặc biệt, giữ chữ cái tiếng Việt, số và dấu cách
    text = re.sub(r'[^\w\s]', ' ', text, flags=re.UNICODE)

    # Bỏ số (thường không có ý nghĩa ngữ nghĩa trong bài tự luận)
    text = re.sub(r'\d+', ' ', text)

    # Chuẩn hóa khoảng trắng
    text = re.sub(r'\s+', ' ', text).strip()

    if not text:
        return ""

    # Bước 2: Tách từ tiếng Việt
    # format='text' trả về chuỗi các từ đã ghép (ví dụ: "đồng_chí", "người_lính")
    try:
        tokenized = word_tokenize(text, format='text')
    except Exception:
        # Fallback: tách theo khoảng trắng nếu underthesea lỗi
        tokenized = text

    # Bước 3: Bỏ stopwords và từ ngắn hơn 2 ký tự
    tokens = tokenized.split()
    filtered = [
        token for token in tokens
        if token not in STOPWORDS and len(token) >= 2
    ]

    return ' '.join(filtered)


def preprocess_keywords(keywords: list) -> list:
    """
    Xử lý danh sách từ khóa từ đáp án mẫu.
    Mỗi từ khóa được tách từ và chuẩn hóa để so khớp với bài học sinh.

    Args:
        keywords: ["người lính", "đồng chí", "tình đồng đội"]

    Returns:
        Danh sách từ khóa đã xử lý: ["người_lính", "đồng_chí", "tình_đồng_đội"]
    """
    processed = []
    for kw in keywords:
        try:
            tokenized = word_tokenize(kw.lower(), format='text')
            processed.append(tokenized.strip())
        except Exception:
            processed.append(kw.lower().strip())
    return processed
