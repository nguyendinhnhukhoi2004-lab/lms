require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'exam_system',
  password: process.env.DB_PASSWORD || 'khoi05112004',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  const client = await pool.connect();
  try {
    // --- Thông tin cơ bản ---
    const { rows: qCount } = await client.query('SELECT COUNT(*)::int FROM questions');
    const { rows: eCount } = await client.query('SELECT COUNT(*)::int FROM exams');
    console.log(`Hiện có: ${qCount[0].count} câu hỏi, ${eCount[0].count} đề thi`);

    // Lấy giáo viên Toán khối 10 (tổ trưởng)
    const { rows: toTruong } = await client.query(`
      SELECT u.id, u.full_name FROM users u
      JOIN teacher_subjects ts ON u.id = ts.teacher_id
      JOIN subjects s ON ts.subject_id = s.id
      WHERE u.role = 'department_head' AND s.name = 'Toán 10'
      LIMIT 1
    `);
    // Lấy giáo viên Toán khối 10 (giáo viên thường)
    const { rows: giaoVien } = await client.query(`
      SELECT u.id, u.full_name FROM users u
      JOIN teacher_subjects ts ON u.id = ts.teacher_id
      JOIN subjects s ON ts.subject_id = s.id
      WHERE u.role = 'teacher' AND s.name = 'Toán 10'
      LIMIT 1
    `);
    // Lấy môn Toán 10
    const { rows: monHoc } = await client.query(`SELECT id, name FROM subjects WHERE name = 'Toán 10'`);
    // Lấy lớp 10T1
    const { rows: lopHoc } = await client.query(`SELECT id, name FROM classes WHERE name = '10T1'`);
    // Lấy học sinh lớp 10T1
    const { rows: hocSinh } = await client.query(`
      SELECT id, full_name FROM users WHERE role = 'student' AND class_id = $1 LIMIT 5
    `, [lopHoc[0].id]);

    if (!giaoVien[0]) { console.log('Không tìm thấy giáo viên Toán 10'); return; }
    if (!monHoc[0]) { console.log('Không tìm thấy môn Toán 10'); return; }

    const teacherId = giaoVien[0].id;
    const headId = toTruong[0] ? toTruong[0].id : teacherId;
    const subjectId = monHoc[0].id;
    const classId = lopHoc[0].id;

    console.log(`\nGiáo viên: ${giaoVien[0].full_name}`);
    console.log(`Tổ trưởng: ${toTruong[0]?.full_name}`);
    console.log(`Môn: ${monHoc[0].name}`);
    console.log(`Lớp: ${lopHoc[0].name} (${hocSinh.length} HS mẫu)`);

    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────
    // 1. TẠO 30 CÂU HỎI TRẮC NGHIỆM TOÁN 10
    // ─────────────────────────────────────────────────────────
    const mcqData = [
      // Nhận biết
      { q: 'Tập hợp nào sau đây là tập hợp con của tập hợp N?', a: ['Tập Z', 'Tập N*', 'Tập R', 'Tập Q'], c: 1, level: 'nhan_biet', topic: 'Tập hợp số' },
      { q: 'Số nào sau đây là số nguyên tố?', a: ['1', '4', '7', '9'], c: 2, level: 'nhan_biet', topic: 'Số nguyên' },
      { q: 'Giá trị của |−5| bằng bao nhiêu?', a: ['−5', '5', '0', '25'], c: 1, level: 'nhan_biet', topic: 'Giá trị tuyệt đối' },
      { q: 'Hàm số y = x² có đồ thị là?', a: ['Đường thẳng', 'Parabol', 'Hyperbol', 'Đường tròn'], c: 1, level: 'nhan_biet', topic: 'Hàm số' },
      { q: 'Khi x = 2, giá trị của hàm số y = 3x − 1 là?', a: ['5', '7', '3', '1'], c: 0, level: 'nhan_biet', topic: 'Hàm số' },
      { q: 'Đạo hàm của hàm số y = x³ là?', a: ['3x²', 'x²', '3x', '3'], c: 0, level: 'nhan_biet', topic: 'Đạo hàm' },
      { q: 'Nghiệm của phương trình 2x + 4 = 0 là?', a: ['x = 2', 'x = −2', 'x = 4', 'x = −4'], c: 1, level: 'nhan_biet', topic: 'Phương trình' },
      { q: 'Logarit cơ số 10 của 1000 bằng?', a: ['2', '3', '4', '10'], c: 1, level: 'nhan_biet', topic: 'Hàm logarit' },
      { q: 'Cạnh huyền của tam giác vuông có hai cạnh góc vuông là 3 và 4 là?', a: ['5', '6', '7', '25'], c: 0, level: 'nhan_biet', topic: 'Lượng giác' },
      { q: 'Tổng các góc trong một tam giác bằng?', a: ['180°', '360°', '90°', '270°'], c: 0, level: 'nhan_biet', topic: 'Hình học phẳng' },
      // Thông hiểu
      { q: 'Phương trình x² − 5x + 6 = 0 có nghiệm là?', a: ['x=1, x=6', 'x=2, x=3', 'x=−2, x=−3', 'x=2, x=−3'], c: 1, level: 'thong_hieu', topic: 'Phương trình bậc hai' },
      { q: 'Hàm số y = x² − 4x + 3 đạt giá trị nhỏ nhất tại x bằng?', a: ['1', '2', '3', '−2'], c: 1, level: 'thong_hieu', topic: 'Hàm số bậc hai' },
      { q: 'Tập nghiệm của bất phương trình 2x − 6 > 0 là?', a: ['x < 3', 'x > 3', 'x ≤ 3', 'x ≥ 3'], c: 1, level: 'thong_hieu', topic: 'Bất phương trình' },
      { q: 'Đạo hàm của y = sin(x) là?', a: ['cos(x)', '−cos(x)', 'sin(x)', '−sin(x)'], c: 0, level: 'thong_hieu', topic: 'Đạo hàm lượng giác' },
      { q: 'Kết quả của C(5,2) bằng?', a: ['10', '20', '5', '15'], c: 0, level: 'thong_hieu', topic: 'Tổ hợp' },
      { q: 'log₂(8) bằng?', a: ['2', '3', '4', '8'], c: 1, level: 'thong_hieu', topic: 'Logarit' },
      { q: 'Chu vi hình tròn bán kính r là?', a: ['πr²', '2πr', 'πr', '4πr'], c: 1, level: 'thong_hieu', topic: 'Hình học' },
      { q: 'Điểm M(2, −3) thuộc góc phần tư nào trong hệ tọa độ Oxy?', a: ['I', 'II', 'III', 'IV'], c: 3, level: 'thong_hieu', topic: 'Tọa độ phẳng' },
      { q: 'Số cách sắp xếp 4 người vào 4 ghế là?', a: ['4', '12', '24', '16'], c: 2, level: 'thong_hieu', topic: 'Hoán vị' },
      { q: 'Phần tử nào KHÔNG thuộc tập A = {1; 2; 3; 4; 5}?', a: ['2', '3', '6', '4'], c: 2, level: 'thong_hieu', topic: 'Tập hợp' },
      // Vận dụng
      { q: 'Tìm m để phương trình x² + 2x + m = 0 có hai nghiệm phân biệt.', a: ['m < 1', 'm > 1', 'm = 1', 'm ≤ 1'], c: 0, level: 'van_dung', topic: 'Phương trình bậc hai' },
      { q: 'Giải bất phương trình x² − x − 6 > 0.', a: ['−2 < x < 3', 'x < −2 hoặc x > 3', 'x ≤ −2 hoặc x ≥ 3', 'x > 3'], c: 1, level: 'van_dung', topic: 'Bất phương trình bậc hai' },
      { q: 'Cho hàm số y = 2x³ − 3x² − 12x + 1. Hàm số đồng biến trên khoảng nào?', a: ['(−1; 2)', '(−∞; −1) và (2; +∞)', '(0; 3)', '(−2; 1)'], c: 1, level: 'van_dung', topic: 'Đơn điệu hàm số' },
      { q: 'Tính xác suất để tung một đồng xu 3 lần đều ra mặt ngửa.', a: ['1/2', '1/4', '1/8', '3/8'], c: 2, level: 'van_dung', topic: 'Xác suất' },
      { q: 'Tổng của cấp số cộng 1 + 3 + 5 + ... + 99 bằng?', a: ['2500', '2500', '2500', '2500'], c: 0, level: 'van_dung', topic: 'Cấp số cộng' },
      // Vận dụng (bao gồm cả mức nâng cao — CV 7991: gộp vào "Vận dụng")
      { q: 'Tìm giá trị lớn nhất của hàm số y = −x² + 4x − 1 trên đoạn [0; 3].', a: ['2', '3', '−1', '4'], c: 1, level: 'van_dung', topic: 'Cực trị hàm số' },
      { q: 'Số nghiệm thực của phương trình 2^x = x + 2 là?', a: ['0', '1', '2', '3'], c: 2, level: 'van_dung', topic: 'Phương trình mũ' },
      { q: 'Cho tam giác ABC với AB = 5, BC = 7, AC = 6. Diện tích tam giác ABC bằng?', a: ['12√2', '6√6', '9√6', '3√2'], c: 1, level: 'van_dung', topic: 'Hệ thức lượng' },
      { q: 'Tổng 20 số hạng đầu của cấp số nhân với u₁ = 1 và q = 2 là?', a: ['2²⁰ − 1', '2²⁰', '2²¹ − 1', '2¹⁹ − 1'], c: 0, level: 'van_dung', topic: 'Cấp số nhân' },
      { q: 'Giới hạn lim(x→∞) (3x² + 2x)/(x² − 1) bằng?', a: ['0', '1', '2', '3'], c: 3, level: 'van_dung', topic: 'Giới hạn hàm số' },
    ];

    const questionIds = [];
    for (const q of mcqData) {
      const options = JSON.stringify(q.a);
      const correctAnswer = JSON.stringify(q.c); // jsonb: số index
      const { rows } = await client.query(`
        INSERT INTO questions (subject_id, created_by, type, content, options, correct_answer, difficulty, is_approved)
        VALUES ($1, $2, 'multiple_choice', $3, $4::jsonb, $5::jsonb, $6, true)
        RETURNING id
      `, [subjectId, teacherId, q.q, options, correctAnswer, q.level]);
      questionIds.push(rows[0].id);
    }
    console.log(`\nĐã tạo ${questionIds.length} câu hỏi trắc nghiệm Toán 10`);

    // ─────────────────────────────────────────────────────────
    // 2. TẠO 5 CÂU HỎI TỰ LUẬN
    // ─────────────────────────────────────────────────────────
    const essayData = [
      {
        q: 'Giải phương trình bậc hai: x² − 5x + 6 = 0. Trình bày đầy đủ các bước giải.',
        sample: 'Phương trình x² − 5x + 6 = 0. Tính delta: Δ = 25 − 24 = 1 > 0. Hai nghiệm phân biệt: x₁ = (5+1)/2 = 3, x₂ = (5−1)/2 = 2. Vậy phương trình có hai nghiệm x = 2 và x = 3.',
        keywords: ['delta', 'nghiệm', 'phân biệt', 'x=2', 'x=3'],
        level: 'thong_hieu', topic: 'Phương trình bậc hai', score: 2
      },
      {
        q: 'Tìm tập xác định của hàm số y = √(x − 1) + 1/(x − 3). Giải thích cách tìm.',
        sample: 'Hàm số xác định khi: x−1 ≥ 0 và x−3 ≠ 0, tức là x ≥ 1 và x ≠ 3. Tập xác định D = [1; +∞) \\ {3}.',
        keywords: ['tập xác định', 'x≥1', 'x≠3', 'căn bậc hai', 'mẫu số'],
        level: 'thong_hieu', topic: 'Hàm số', score: 2
      },
      {
        q: 'Chứng minh rằng với mọi số nguyên n, n² − n luôn chia hết cho 2.',
        sample: 'Ta có n² − n = n(n−1) là tích của hai số nguyên liên tiếp n và n−1. Trong hai số nguyên liên tiếp luôn có một số chẵn, do đó tích n(n−1) chia hết cho 2. Vậy n² − n ⋮ 2.',
        keywords: ['tích', 'liên tiếp', 'số chẵn', 'chia hết', 'chứng minh'],
        level: 'van_dung', topic: 'Số học', score: 3
      },
      {
        q: 'Một xạ thủ bắn 3 phát đạn. Xác suất mỗi phát trúng đích là 0,8. Tính xác suất để ít nhất 2 phát trúng đích.',
        sample: 'Gọi p = 0,8 là xác suất trúng đích mỗi phát. q = 0,2. Xác suất đúng 2 phát: C(3,2)×0,8²×0,2 = 3×0,64×0,2 = 0,384. Xác suất đúng 3 phát: 0,8³ = 0,512. Xác suất ít nhất 2 phát = 0,384 + 0,512 = 0,896.',
        keywords: ['xác suất', 'C(3,2)', '0,8', 'ít nhất', 'tổ hợp'],
        level: 'van_dung', topic: 'Xác suất', score: 3
      },
      {
        q: 'Tìm giá trị lớn nhất và nhỏ nhất của hàm số y = x³ − 3x + 2 trên đoạn [−2; 2]. Giải thích.',
        sample: 'y\' = 3x² − 3 = 0 → x = ±1. Tính giá trị: y(−2) = −8+6+2 = 0; y(−1) = −1+3+2 = 4; y(1) = 1−3+2 = 0; y(2) = 8−6+2 = 4. Giá trị lớn nhất M = 4 tại x = ±1. Giá trị nhỏ nhất m = 0 tại x = −2 và x = 1.',
        keywords: ['đạo hàm', 'cực trị', 'giá trị lớn nhất', 'giá trị nhỏ nhất', 'đoạn'],
        level: 'van_dung', topic: 'Cực trị hàm số', score: 4 // mức vận dụng — CV 7991
      },
    ];

    const essayIds = [];
    for (const q of essayData) {
      const correctAnswer = JSON.stringify(q.sample); // jsonb: chuỗi đáp án mẫu
      const { rows } = await client.query(`
        INSERT INTO questions (subject_id, created_by, type, content, correct_answer, difficulty, is_approved)
        VALUES ($1, $2, 'essay', $3, $4::jsonb, $5, true)
        RETURNING id
      `, [subjectId, teacherId, q.q, correctAnswer, q.level]);
      essayIds.push(rows[0].id);
    }
    console.log(`Đã tạo ${essayIds.length} câu hỏi tự luận Toán 10`);

    // ─────────────────────────────────────────────────────────
    // 3. TẠO ĐỀ THI (trắc nghiệm + tự luận)
    // ─────────────────────────────────────────────────────────
    const { rows: exam1 } = await client.query(`
      INSERT INTO exams (subject_id, created_by, title, description, duration_minutes, status)
      VALUES ($1, $2, 'Kiểm tra giữa kỳ 1 - Toán 10', 'Đề kiểm tra giữa kỳ 1 môn Toán lớp 10 năm học 2024-2025. Gồm 20 câu trắc nghiệm và 2 câu tự luận.', 90, 'draft')
      RETURNING id, title
    `, [subjectId, teacherId]);
    const examId1 = exam1[0].id;

    // Chọn câu hỏi cho đề: 20 MCQ + 2 essay
    const selectedMCQ = questionIds.slice(0, 20);
    const selectedEssay = essayIds.slice(0, 2);
    const allQuestions = [...selectedMCQ, ...selectedEssay];
    
    for (let i = 0; i < allQuestions.length; i++) {
      const qId = allQuestions[i];
      const isMCQ = i < 20;
      await client.query(`
        INSERT INTO exam_questions (exam_id, question_id, order_index, score)
        VALUES ($1, $2, $3, $4)
      `, [examId1, qId, i + 1, isMCQ ? 0.25 : 2]);
    }

    // ─────────────────────────────────────────────────────────
    // 4. TẠO ĐỀ THI THỨ 2 (đã được duyệt - để test phòng thi)
    // ─────────────────────────────────────────────────────────
    const { rows: exam2 } = await client.query(`
      INSERT INTO exams (subject_id, created_by, title, description, duration_minutes, status)
      VALUES ($1, $2, 'Kiểm tra cuối kỳ 1 - Toán 10', 'Đề kiểm tra cuối kỳ 1 môn Toán lớp 10. Gồm 28 câu trắc nghiệm và 3 câu tự luận.', 90, 'approved')
      RETURNING id, title
    `, [subjectId, headId]);
    const examId2 = exam2[0].id;

    const selectedMCQ2 = questionIds.slice(0, 28);
    const selectedEssay2 = essayIds.slice(0, 3);
    const allQ2 = [...selectedMCQ2, ...selectedEssay2];
    for (let i = 0; i < allQ2.length; i++) {
      const isMCQ = i < 28;
      await client.query(`
        INSERT INTO exam_questions (exam_id, question_id, order_index, score)
        VALUES ($1, $2, $3, $4)
      `, [examId2, allQ2[i], i + 1, isMCQ ? 0.25 : (2 / 3)]);
    }

    // ─────────────────────────────────────────────────────────
    // 5. TẠO PHÒNG THI + LỊCH THI cho đề đã duyệt
    // ─────────────────────────────────────────────────────────
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 phút nữa
    const endTime = new Date(startTime.getTime() + 90 * 60 * 1000);

    const { rows: room } = await client.query(`
      INSERT INTO exam_rooms (exam_id, name, capacity)
      VALUES ($1, $2, 40)
      RETURNING id, name
    `, [examId2, 'Phòng thi 101 - Toán 10T1']);
    const roomId = room[0].id;

    // Thêm học sinh vào phòng thi
    for (const hs of hocSinh) {
      await client.query(`
        INSERT INTO exam_room_students (room_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
      `, [roomId, hs.id]);
    }

    await client.query('COMMIT');

    // ─────────────────────────────────────────────────────────
    // In kết quả
    // ─────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(80));
    console.log('  DỮ LIỆU MẪU ĐÃ TẠO THÀNH CÔNG');
    console.log('='.repeat(80));
    console.log(`\n📝 ĐỀ THI 1 (draft — để test luồng tạo → nộp → duyệt):`);
    console.log(`   Tên: ${exam1[0].title}`);
    console.log(`   Gồm: 20 câu trắc nghiệm + 2 câu tự luận`);
    console.log(`   Trạng thái: DRAFT (Giáo viên có thể nộp lên tổ trưởng duyệt)`);
    console.log(`\n✅ ĐỀ THI 2 (approved — để test thi trực tuyến):`);
    console.log(`   Tên: ${exam2[0].title}`);
    console.log(`   Gồm: 28 câu trắc nghiệm + 3 câu tự luận`);
    console.log(`   Trạng thái: APPROVED`);
    console.log(`\n🚪 PHÒNG THI:`);
    console.log(`   Tên phòng: ${room[0].name}`);
    console.log(`   Thời gian bắt đầu: ${startTime.toLocaleString('vi-VN')} (khoảng 10 phút nữa)`);
    console.log(`   Học sinh đã xếp vào phòng: ${hocSinh.length} em lớp 10T1`);
    console.log(`\n📋 TÀI KHOẢN TEST:`);
    console.log(`   Giáo viên (tạo đề): ${giaoVien[0].full_name} | Email: trambn22@thpt.edu.vn | Mật khẩu: Test@123`);
    console.log(`   Tổ trưởng (duyệt đề): ${toTruong[0]?.full_name} | Email: hangnn15@thpt.edu.vn | Mật khẩu: Test@123`);
    console.log(`   Admin: admin@thpt.edu.vn | Mật khẩu: admin123`);
    if (hocSinh[0]) {
      console.log(`   Học sinh (làm bài): ${hocSinh[0].full_name} | (email xem trong DB)`);
    }
    console.log('\n' + '='.repeat(80));
    console.log('  HƯỚNG DẪN TEST TỪNG CHỨC NĂNG:');
    console.log('='.repeat(80));
    console.log('  1. [Giáo viên] Đăng nhập → Quản lý đề thi → Mở đề "Giữa kỳ 1" → Nộp lên tổ trưởng');
    console.log('  2. [Tổ trưởng] Đăng nhập → Quản lý đề thi → Duyệt đề "Giữa kỳ 1"');
    console.log('  3. [Admin] Tạo phòng thi hoặc vào phòng đã có → Quản lý học sinh trong phòng');
    console.log('  4. [Học sinh 10T1] Đăng nhập → Phòng thi → Làm bài "Cuối kỳ 1" → Nộp bài');
    console.log('  5. [Giáo viên] Quản lý đề thi → Chấm tự luận → Xem điểm gợi ý NLP');
    console.log('='.repeat(80) + '\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi:', err.message, err.stack);
  } finally {
    client.release();
    pool.end();
  }
}

run();
