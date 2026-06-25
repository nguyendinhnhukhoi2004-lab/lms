# 🎓 Hệ Thống Quản Lý Đề Thi & Đánh Giá Tự Động THPT

> **Đề tài Khóa luận tốt nghiệp** — Xây dựng hệ thống quản lý đề thi, tổ chức thi cử và chấm điểm tự luận tự động bằng NLP cho trường THPT.

---

## 📋 Mục Lục

- [Giới thiệu](#giới-thiệu)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Tính năng chính](#tính-năng-chính)
- [Cài đặt & Chạy dự án](#cài-đặt--chạy-dự-án)
- [Cấu trúc cơ sở dữ liệu](#cấu-trúc-cơ-sở-dữ-liệu)
- [Phân quyền hệ thống](#phân-quyền-hệ-thống)
- [Tổ chức lớp học & môn học](#tổ-chức-lớp-học--môn-học)
- [Quy trình chấm tự luận tự động](#quy-trình-chấm-tự-luận-tự-động)
- [API Overview](#api-overview)
- [Tài khoản mặc định](#tài-khoản-mặc-định)

---

## Giới Thiệu

Hệ thống được xây dựng nhằm số hóa và tự động hóa toàn bộ quy trình quản lý đề thi tại các trường THPT theo chương trình GDPT 2018. Hệ thống hỗ trợ:

- **Quản lý tổ chức**: Lớp học, môn học, giáo viên, học sinh theo đúng cấu trúc trường THPT.
- **Ngân hàng câu hỏi**: Xây dựng và quản lý câu hỏi trắc nghiệm (nhiều lựa chọn) và tự luận theo ma trận đề thi, chuẩn NL-YC.
- **Tạo & duyệt đề thi**: Luồng tạo đề → giáo viên nộp → tổ trưởng duyệt → admin phê duyệt.
- **Tổ chức thi**: Tạo phòng thi, xếp học sinh vào phòng, thiết lập lịch thi, học sinh làm bài online.
- **Chấm điểm tự động**: Câu trắc nghiệm chấm tức thì; câu tự luận được chấm gợi ý bởi mô-đun NLP (TF-IDF + Gemini AI).
- **Thống kê & báo cáo**: Dashboard thống kê điểm theo lớp, môn, giáo viên.

---

## Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────┐
│                     TRÌNH DUYỆT                         │
│              React + Vite (port 5173)                   │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP REST API
┌─────────────────────▼───────────────────────────────────┐
│              BACKEND (Node.js + Express)                │
│                     port 3000                           │
│                                                         │
│  Auth │ Users │ Classes │ Subjects │ Questions          │
│  Exams │ Submissions │ Statistics │ Teacher-Subjects    │
└────────────┬────────────────────────┬───────────────────┘
             │ PostgreSQL             │ HTTP (chấm tự luận)
┌────────────▼───────┐   ┌───────────▼───────────────────┐
│   PostgreSQL DB    │   │      NLP Service (Python)      │
│     port 5432      │   │      Flask  port 5001          │
│                    │   │                                │
│  16 bảng dữ liệu   │   │  TF-IDF Cosine Similarity     │
│                    │   │  Keyword Coverage              │
└────────────────────┘   │  Gemini AI (LLM scoring)      │
                         └────────────────────────────────┘
```

---

## Công Nghệ Sử Dụng

### Backend
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Node.js | ≥ 18 | Runtime |
| Express.js | 4.18 | Web framework |
| PostgreSQL | 18 | Cơ sở dữ liệu |
| JSON Web Token | 9.0 | Xác thực |
| bcryptjs | 2.4 | Mã hóa mật khẩu |
| Multer | 2.1 | Upload file (Excel/Word) |
| XLSX | 0.18 | Đọc file Excel import học sinh |
| Mammoth | 1.12 | Đọc file Word import câu hỏi |

### Frontend
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| React | 18 | UI framework |
| Vite | 5 | Build tool & Dev server |
| React Router | 6 | Routing |
| Vanilla CSS | — | Styling |

### NLP Service
| Công nghệ | Phiên bản | Vai trò |
|-----------|-----------|---------|
| Python | ≥ 3.10 | Runtime |
| Flask | 3.0 | Web framework |
| underthesea | 6.8 | Tokenizer tiếng Việt |
| scikit-learn | 1.5 | TF-IDF, Cosine Similarity |
| Google Generative AI | 0.8 | Gemini API chấm LLM |
| numpy | 1.26 | Xử lý vector |

---

## Cấu Trúc Dự Án

```
exam-system/
│
├── server.js                   # Entry point backend
├── package.json
├── .env                        # Biến môi trường backend
├── .env.example
│
├── src/                        # Backend source
│   ├── app.js                  # Express app setup
│   ├── config/
│   │   └── db.js               # Kết nối PostgreSQL
│   ├── controllers/            # Xử lý logic API
│   │   ├── auth.controller.js
│   │   ├── users.controller.js
│   │   ├── classes.controller.js
│   │   ├── subjects.controller.js
│   │   ├── questions.controller.js
│   │   ├── exams.controller.js
│   │   ├── submissions.controller.js
│   │   ├── teacher_subjects.controller.js
│   │   └── statistics.controller.js
│   ├── models/                 # Truy vấn DB
│   ├── routes/                 # Định nghĩa route
│   ├── middlewares/            # Auth, validate, upload
│   └── utils/                  # NLP service client, helpers
│
├── frontend/                   # React frontend
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx             # Router chính
│       ├── main.jsx
│       ├── index.css           # CSS toàn cục
│       ├── pages/              # Các trang chính
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── AdminDashboard.jsx
│       │   ├── UserManagement.jsx   # Quản lý GV/HS/Tổ trưởng
│       │   ├── ClassManagement.jsx
│       │   ├── SubjectManagement.jsx
│       │   ├── QuestionBank.jsx
│       │   ├── ExamManagement.jsx
│       │   ├── ExamRoom.jsx         # Học sinh làm bài
│       │   ├── GradeEssay.jsx       # Giáo viên chấm tự luận
│       │   ├── Gradebook.jsx
│       │   └── Statistics.jsx
│       ├── components/         # UI components dùng chung
│       ├── services/
│       │   └── api.js          # Toàn bộ API calls
│       ├── context/            # Auth context
│       └── hooks/              # Custom hooks
│
├── nlp-service/                # Python NLP microservice
│   ├── app.py                  # Flask server (port 5001)
│   ├── scorer.py               # TF-IDF + keyword scoring
│   ├── llm_scorer.py           # Gemini AI scoring
│   ├── preprocessor.py         # Tokenizer tiếng Việt
│   ├── requirements.txt
│   └── .env                    # GEMINI_API_KEY
│
└── database/
    ├── schema_full.sql         # Toàn bộ schema DB
    └── seed_full.sql           # Dữ liệu mẫu đầy đủ
```

---

## Tính Năng Chính

### 👤 Quản lý người dùng (Admin)
- Tạo, chỉnh sửa, khóa/mở tài khoản **Giáo viên**, **Tổ trưởng**, **Học sinh**
- Import hàng loạt học sinh qua file **Excel (.xlsx)**
- Phân công giáo viên dạy theo **từng môn từng khối lớp** (tổ trưởng cũng đồng thời giảng dạy)
- Hiển thị môn giảng dạy, lớp phụ trách ngay trong bảng danh sách

### 🏫 Quản lý lớp & môn học
- **36 lớp học** (3 khối × 12 lớp): 7 lớp T (KHTN) + 5 lớp X (KHXH) mỗi khối
- Tổ hợp môn đúng theo Chương trình GDPT 2018:
  - **T1–T5**: Vật lý, Hóa học, Sinh học, Tin học
  - **T6**: Vật lý, Hóa học, Sinh học, Địa lý
  - **T7**: Vật lý, Tin học, Địa lý
  - **X1, X2**: Địa lý, GDKTPL, Tin học, Công nghệ Công nghiệp
  - **X3, X4**: Địa lý, GDKTPL, Tin học, Công nghệ Nông nghiệp
  - **X5**: Địa lý, GDKTPL, Tin học
  - Tất cả lớp đều học: **Toán, Ngữ văn, Tiếng Anh, Lịch sử**
- Quản lý danh sách học sinh theo lớp

### 📝 Ngân hàng câu hỏi
- Soạn câu hỏi **trắc nghiệm** (4 lựa chọn) và **tự luận**
- Gắn tag: **môn học, khối lớp, mức độ** (Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao), **chủ đề**
- Nhập câu hỏi từ file **Word (.docx)** hàng loạt
- Tìm kiếm, lọc theo nhiều tiêu chí

### 📄 Tạo & Duyệt đề thi
Luồng duyệt 3 bước:

```
Giáo viên tạo đề (draft)
        ↓
  Nộp lên tổ trưởng (pending_approval)
        ↓
  Tổ trưởng duyệt (approved)
        ↓
  [Admin có thể archive]
```

- Tạo đề **thủ công** (chọn từng câu) hoặc **tự động** theo ma trận (số câu theo mức độ)
- Hỗ trợ kết hợp câu trắc nghiệm và tự luận trong cùng một đề
- Cài đặt thời gian làm bài

### 🖥️ Tổ chức thi (Phòng thi)
- Tạo **phòng thi** gắn với đề và lịch thi cụ thể
- Xếp học sinh từ nhiều lớp vào phòng thi
- Học sinh đăng nhập và làm bài trực tuyến trong thời gian quy định
- **Nộp bài tự động** khi hết giờ

### ✅ Chấm điểm
- **Trắc nghiệm**: Chấm tức thì, hiển thị điểm ngay sau khi nộp
- **Tự luận**: 
  - NLP Service tự động gợi ý điểm (TF-IDF + Keyword + Gemini)
  - Giáo viên xem gợi ý và **quyết định điểm cuối cùng** tại trang `GradeEssay`
  - Giáo viên có thể ghi nhận xét cho từng câu

### 📊 Thống kê & Báo cáo
- Dashboard tổng quan: số lớp, môn, giáo viên, học sinh, đề thi
- Thống kê điểm trung bình theo lớp, theo môn
- Biểu đồ phân bố điểm

---

## Cài Đặt & Chạy Dự Án

### Yêu cầu hệ thống
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 15
- **Python** ≥ 3.10
- **pip** (Python package manager)

### 1. Clone & Cài đặt Backend

```bash
# Cài đặt dependencies backend
npm install

# Tạo file .env từ mẫu
cp .env.example .env
# Chỉnh sửa .env theo cấu hình DB của bạn
```

Nội dung `.env` backend:
```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=exam_system
DB_PASSWORD=your_password
DB_PORT=5432
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
NLP_SERVICE_URL=http://localhost:5001
```

### 2. Khởi tạo Cơ sở dữ liệu

```bash
# Tạo database
psql -U postgres -c "CREATE DATABASE exam_system;"

# Khởi tạo schema
psql -U postgres -d exam_system -f database/schema_full.sql

# (Tùy chọn) Nạp dữ liệu mẫu đầy đủ
psql -U postgres -d exam_system -f database/seed_full.sql
```

### 3. Cài đặt Frontend

```bash
cd frontend
npm install
```

### 4. Cài đặt NLP Service

```bash
cd nlp-service

# Tạo virtual environment (khuyến nghị)
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate # Linux/Mac

# Cài đặt dependencies
pip install -r requirements.txt

# Tạo file .env cho NLP service
# Thêm GEMINI_API_KEY nếu muốn dùng tính năng chấm LLM
cp .env.example .env   # hoặc tạo thủ công
```

Nội dung `.env` của NLP service:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
USE_LLM=true
```

### 5. Chạy dự án

Mở **3 terminal** riêng biệt:

**Terminal 1 — Backend:**
```bash
# Tại thư mục gốc exam-system/
npm run dev
# → http://localhost:3000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# → http://localhost:5173
```

**Terminal 3 — NLP Service:**
```bash
cd nlp-service
python app.py
# → http://localhost:5001
```

---

## Cấu Trúc Cơ Sở Dữ Liệu

| Bảng | Mô tả |
|------|-------|
| `users` | Tài khoản (admin, teacher, department_head, student) |
| `classes` | 36 lớp học (10T1…12X5) |
| `subjects` | Môn học theo khối (Toán 10, Vật lý 11…) |
| `class_subjects` | Phân công giáo viên dạy lớp-môn |
| `teacher_subjects` | Môn giáo viên được phép tạo đề |
| `head_subjects` | Môn tổ trưởng quản lý |
| `questions` | Ngân hàng câu hỏi (MCQ + tự luận) |
| `exams` | Đề thi (draft→approved) |
| `exam_questions` | Câu hỏi trong đề thi (có thứ tự, điểm) |
| `exam_matrix` | Ma trận đề thi |
| `exam_schedules` | Lịch thi |
| `exam_rooms` | Phòng thi |
| `exam_room_students` | Học sinh trong phòng thi |
| `submissions` | Bài nộp của học sinh |
| `submission_answers` | Câu trả lời từng câu (có auto_score, similarity_score) |
| `results` | Kết quả tổng hợp |

---

## Phân Quyền Hệ Thống

| Role | Quyền hạn |
|------|-----------|
| **admin** | Toàn quyền: quản lý người dùng, lớp, môn, xem mọi đề thi, thống kê |
| **department_head** (Tổ trưởng) | Duyệt đề thi của giáo viên trong tổ, tạo đề, **đồng thời giảng dạy** |
| **teacher** (Giáo viên) | Tạo đề, soạn câu hỏi, chấm tự luận, xem kết quả lớp mình |
| **student** (Học sinh) | Làm bài thi, xem kết quả của bản thân |

---

## Tổ Chức Lớp Học & Môn Học

### Cấu trúc lớp

Mỗi khối (10, 11, 12) có **12 lớp**:
- **7 lớp KHTN**: T1, T2, T3, T4, T5, T6, T7
- **5 lớp KHXH**: X1, X2, X3, X4, X5

Tổng: **36 lớp**, mỗi lớp khoảng 35 học sinh.

### Tổ hợp môn theo lớp

| Lớp | Môn bắt buộc | Môn lựa chọn |
|-----|-------------|--------------|
| T1–T5 | Toán, Ngữ văn, Tiếng Anh, Lịch sử | Vật lý, Hóa học, Sinh học, Tin học |
| T6 | Toán, Ngữ văn, Tiếng Anh, Lịch sử | Vật lý, Hóa học, Sinh học, Địa lý |
| T7 | Toán, Ngữ văn, Tiếng Anh, Lịch sử | Vật lý, Tin học, Địa lý |
| X1, X2 | Toán, Ngữ văn, Tiếng Anh, Lịch sử | Địa lý, GDKTPL, Tin học, Công nghệ CN |
| X3, X4 | Toán, Ngữ văn, Tiếng Anh, Lịch sử | Địa lý, GDKTPL, Tin học, Công nghệ NN |
| X5 | Toán, Ngữ văn, Tiếng Anh, Lịch sử | Địa lý, GDKTPL, Tin học |

### Phân công giáo viên

- Mỗi giáo viên chỉ dạy **đúng 1 khối lớp** (10 hoặc 11 hoặc 12)
- Các lớp phụ trách được xếp **liền kề nhau** (ví dụ: T1–T6, không bị rải rác)
- Tổ trưởng cũng đồng thời là giáo viên có phân công lớp
- Mục tiêu tải: **~8 lớp/GV** cho Toán/Văn/Anh; **~6 lớp/GV** cho Tin học/Lịch sử; **~4 lớp/GV** cho các môn còn lại

---

## Quy Trình Chấm Tự Luận Tự Động

```
Học sinh nộp bài
       ↓
Backend gửi sang NLP Service (POST /grade-essay)
  {student_text, sample_text, keywords, max_score}
       ↓
NLP Service xử lý:
  1. Tiền xử lý văn bản (underthesea tokenizer)
  2. TF-IDF Cosine Similarity (so sánh bài với đáp án mẫu)
  3. Keyword Coverage (kiểm tra từ khóa quan trọng)
  4. Kết hợp → suggested_score (gợi ý)
  5. (Tùy chọn) Gemini AI re-scoring
       ↓
Backend lưu: auto_score, similarity_score vào submission_answers
       ↓
Giáo viên vào trang GradeEssay:
  - Xem bài học sinh
  - Xem điểm gợi ý từ NLP
  - Ghi điểm cuối cùng + nhận xét
       ↓
Điểm được lưu vào bảng results
```

---

## API Overview

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login` | Đăng nhập |
| GET | `/api/users` | Danh sách người dùng |
| POST | `/api/users` | Tạo tài khoản |
| POST | `/api/users/import-students` | Import học sinh từ Excel |
| GET | `/api/classes` | Danh sách lớp học |
| GET | `/api/subjects` | Danh sách môn học |
| GET | `/api/questions` | Ngân hàng câu hỏi |
| POST | `/api/questions` | Tạo câu hỏi mới |
| POST | `/api/questions/import-docx` | Import câu hỏi từ Word |
| GET | `/api/exams` | Danh sách đề thi |
| POST | `/api/exams` | Tạo đề thi |
| PATCH | `/api/exams/:id/submit` | Nộp đề lên tổ trưởng |
| PATCH | `/api/exams/:id/approve` | Tổ trưởng duyệt đề |
| POST | `/api/exams/:id/rooms` | Tạo phòng thi |
| POST | `/api/submissions` | Học sinh nộp bài |
| GET | `/api/submissions/:id/grade-essays` | Danh sách bài tự luận cần chấm |
| PATCH | `/api/submissions/answers/:id/grade` | Giáo viên chấm câu tự luận |
| GET | `/api/statistics/overview` | Thống kê tổng quan |

Chi tiết đầy đủ xem tại [`API_DOCS.txt`](./API_DOCS.txt).

---

## Tài Khoản Mặc Định

| Role | Email | Mật khẩu |
|------|-------|----------|
| Admin | `admin@thpt.edu.vn` | `admin123` |
| Giáo viên / Tổ trưởng | *(xem DB seed)* | `123456` |
| Học sinh | *(xem DB seed)* | `123456` |

> ⚠️ Thay đổi mật khẩu admin ngay sau khi cài đặt lần đầu trong môi trường thực tế.

---

## Phát Triển & Đóng Góp

```bash
# Kiểm tra lint
cd frontend && npm run lint

# Chạy test NLP
cd nlp-service && python test_scorer.py

# Khởi tạo lại phân công giáo viên (nếu cần)
node reassign_and_adjust_teachers.js
```

---

## Giấy Phép

Dự án được xây dựng phục vụ mục đích nghiên cứu và học thuật trong khuôn khổ Khóa luận tốt nghiệp.

---

*Phát triển bởi sinh viên Khoa Công nghệ Thông tin — © 2025–2026*
