import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
import math

load_dotenv()

# Cấu hình API key
api_key = os.getenv("GEMINI_API_KEY", "")
if api_key:
    genai.configure(api_key=api_key)

def round_up_to_quarter(score: float) -> float:
    if score <= 0:
        return 0.0
    return math.ceil(score / 0.25) * 0.25

def grade_with_gemini(student_text: str, sample_text: str, keywords: list, max_score: float) -> dict:
    """
    Sử dụng Gemini để chấm điểm tự luận theo ngữ nghĩa.
    Trả về dict chứa:
    - score: Điểm số (float)
    - note: Nhận xét của AI (string)
    """
    if not api_key or api_key == "your_api_key_here":
        return {
            "error": "Chưa cấu hình GEMINI_API_KEY",
            "score": 0.0,
            "note": "Lỗi hệ thống: Chưa cấu hình AI."
        }

    try:
        # Sử dụng mô hình flash vì nó nhanh và rẻ
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
Bạn là một giáo viên chấm thi tự luận công tâm và chính xác.
Dưới đây là đáp án mẫu, từ khóa quan trọng, và bài làm của học sinh.
Hãy chấm điểm bài làm của học sinh dựa trên ĐỘ TƯƠNG ĐỒNG VỀ MẶT Ý NGHĨA (semantic similarity) với đáp án mẫu.
Nếu học sinh dùng từ đồng nghĩa hoặc cách diễn đạt khác nhưng ý nghĩa vẫn đúng thì không bị trừ điểm.

Đáp án mẫu:
"{sample_text}"

Từ khóa quan trọng (tham khảo):
{keywords}

Bài làm của học sinh:
"{student_text}"

Điểm tối đa của câu này: {max_score}

YÊU CẦU ĐẦU RA:
Bạn chỉ được phép trả về duy nhất một chuỗi JSON hợp lệ với cấu trúc sau (không kèm markdown ```json hay bất kỳ văn bản nào khác):
{{
    "score": [điểm số bạn chấm, dạng số thực],
    "note": "[1-2 câu nhận xét ngắn gọn giải thích tại sao bị trừ điểm hoặc khen ngợi nếu làm tốt]"
}}
"""
        
        # Gọi API
        response = model.generate_content(prompt)
        text_response = response.text.strip()
        
        # Xóa markdown nếu Gemini lỡ trả về ```json ... ```
        if text_response.startswith("```json"):
            text_response = text_response.replace("```json", "", 1)
        if text_response.endswith("```"):
            text_response = text_response.rsplit("```", 1)[0]
            
        text_response = text_response.strip()
        
        # Parse JSON
        result = json.loads(text_response)
        
        # Đảm bảo điểm không vượt quá max_score và không âm
        raw_score = float(result.get("score", 0.0))
        raw_score = max(0.0, min(raw_score, max_score))
        
        # Làm tròn điểm theo thang 0.25
        final_score = round_up_to_quarter(raw_score)
        # Fix trường hợp làm tròn vọt qua max_score
        final_score = min(final_score, max_score)
        
        return {
            "score": final_score,
            "note": result.get("note", "")
        }
        
    except Exception as e:
        print(f"[LLM Scorer] Error: {e}")
        return {
            "error": str(e),
            "score": 0.0,
            "note": "Lỗi kết nối AI, vui lòng thử lại."
        }
