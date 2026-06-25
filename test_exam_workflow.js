require('dotenv').config();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

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
    console.log('--- Bắt đầu quy trình tạo dữ liệu Test ---');

    // 1. Lấy giáo viên dạy Ngữ văn 10
    const { rows: tsRows } = await client.query(`
      SELECT cs.id as class_subject_id, cs.teacher_id, cs.subject_id, c.id as class_id, c.name as class_name
      FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      JOIN classes c ON cs.class_id = c.id
      WHERE s.name = 'Ngữ văn 10'
      LIMIT 1
    `);
    
    if (tsRows.length === 0) throw new Error('Không tìm thấy lớp học môn Ngữ văn 10');
    const { class_subject_id, teacher_id, subject_id, class_id, class_name } = tsRows[0];
    
    console.log(`Đã chọn lớp ${class_name} - Ngữ văn 10 (Teacher ID: ${teacher_id})`);

    // 2. Tạo câu hỏi (2 Trắc nghiệm, 1 Tự luận)
    const { rows: q1 } = await client.query(`
      INSERT INTO questions (subject_id, type, difficulty, content, options, correct_answer, created_by)
      VALUES ($1, 'multiple_choice', 'nhan_biet', 'Tác giả của Truyện Kiều là ai?', 
              '{"A": "Nguyễn Du", "B": "Nguyễn Trãi", "C": "Hồ Xuân Hương", "D": "Nam Cao"}', '"A"', $2)
      RETURNING id
    `, [subject_id, teacher_id]);

    const { rows: q2 } = await client.query(`
      INSERT INTO questions (subject_id, type, difficulty, content, options, correct_answer, created_by)
      VALUES ($1, 'multiple_choice', 'thong_hieu', 'Đoạn trích "Trao duyên" nằm ở phần nào của Truyện Kiều?', 
              '{"A": "Gặp gỡ và đính ước", "B": "Gia biến và lưu lạc", "C": "Đoàn tụ", "D": "Phụ lục"}', '"B"', $2)
      RETURNING id
    `, [subject_id, teacher_id]);

    const { rows: q3 } = await client.query(`
      INSERT INTO questions (subject_id, type, difficulty, content, correct_answer, created_by)
      VALUES ($1, 'essay', 'van_dung', 
              'Phân tích tâm trạng của Thúy Kiều trong đoạn trích Trao duyên.', 
              $3, 
              $2)
      RETURNING id
    `, [subject_id, teacher_id, JSON.stringify({
      sample: 'Thúy Kiều mang tâm trạng đau đớn, xót xa khi phải trao duyên cho Thúy Vân. Nàng cảm thấy day dứt vì lỗi hẹn với Kim Trọng, đồng thời tuyệt vọng về tương lai mịt mù phía trước. Nàng trao lại kỷ vật tình yêu với sự luyến tiếc khôn nguôi.',
      keywords: ['đau đớn', 'xót xa', 'Thúy Vân', 'lỗi hẹn', 'Kim Trọng', 'tuyệt vọng', 'kỷ vật']
    })]);

    console.log('Đã tạo 3 câu hỏi (2 TN, 1 TL)');

    // 3. Tạo Đề thi
    const { rows: exam } = await client.query(`
      INSERT INTO exams (title, subject_id, created_by, duration_minutes, status, exam_type)
      VALUES ('Đề kiểm tra 15 phút Ngữ văn 10', $1, $2, 15, 'approved', 'thuong_xuyen')
      RETURNING id
    `, [subject_id, teacher_id]);
    const exam_id = exam[0].id;

    await client.query(`
      INSERT INTO exam_questions (exam_id, question_id, score, order_index) VALUES 
      ($1, $2, 2.5, 1),
      ($1, $3, 2.5, 2),
      ($1, $4, 5.0, 3)
    `, [exam_id, q1[0].id, q2[0].id, q3[0].id]);

    console.log('Đã tạo Đề thi ID:', exam_id);

    // 4. Tạo Lịch thi (exam_schedules) thay vì Phòng thi
    const { rows: schedule } = await client.query(`
      INSERT INTO exam_schedules (exam_id, class_id, start_time, end_time, is_active)
      VALUES ($1, $2, NOW() - INTERVAL '5 minutes', NOW() + INTERVAL '1 hour', true)
      RETURNING id
    `, [exam_id, class_id]);
    const schedule_id = schedule[0].id;

    console.log(`Đã tạo Lịch thi ID: ${schedule_id} cho lớp ${class_name}.`);

    // Lấy một học sinh để test
    const { rows: students } = await client.query('SELECT id FROM users WHERE role = $1 AND class_id = $2', ['student', class_id]);
    const test_student_id = students[0].id;
    console.log(`Học sinh (ID: ${test_student_id}) bắt đầu làm bài...`);

    // Generate token
    const token = jwt.sign(
      { id: test_student_id, role: 'student', class_id: class_id },
      process.env.JWT_ACCESS_SECRET || 'e54d9d6cd84702728522aed7a6dbe73d3dc4aa15afeac8ea5176475f6704bc14',
      { expiresIn: '1h' }
    );

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    try {
      // BƯỚC 1: Vào phòng thi (enter)
      const enterRes = await fetch('http://localhost:3000/api/submissions/enter', {
        method: 'POST',
        headers,
        body: JSON.stringify({ schedule_id })
      });
      const enterData = await enterRes.json();
      console.log('Enter Data:', enterData);
      if (!enterRes.ok) throw new Error('Lỗi Enter: ' + JSON.stringify(enterData));
      const submission_id = enterData.submission_id || enterData.id || (enterData.submission && enterData.submission.id);
      console.log('Đã vào thi, submission_id:', submission_id);

      // BƯỚC 2: Lưu đáp án trắc nghiệm (q1 đúng A, q2 sai C)
      await fetch(`http://localhost:3000/api/submissions/${submission_id}/answer`, {
        method: 'POST', headers, body: JSON.stringify({ question_id: q1[0].id, student_answer: "A" })
      });
      await fetch(`http://localhost:3000/api/submissions/${submission_id}/answer`, {
        method: 'POST', headers, body: JSON.stringify({ question_id: q2[0].id, student_answer: "C" })
      });

      // BƯỚC 3: Lưu đáp án tự luận
      const student_essay_text = "Thúy Kiều cảm thấy vô cùng đau đớn và xót xa khi phải trao lại kỷ vật cho Thúy Vân. Nàng rất buồn vì đã lỗi hẹn với Kim Trọng và cảm thấy tuyệt vọng về tương lai của mình.";
      await fetch(`http://localhost:3000/api/submissions/${submission_id}/answer`, {
        method: 'POST', headers, body: JSON.stringify({ question_id: q3[0].id, student_answer: { text: student_essay_text } })
      });
      
      console.log('Đã lưu các đáp án, đang nộp bài...');

      // BƯỚC 4: Nộp bài (submit)
      const submitRes = await fetch(`http://localhost:3000/api/submissions/${submission_id}/submit`, {
        method: 'POST', headers
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) throw new Error('Lỗi Submit: ' + JSON.stringify(submitData));
      
      console.log('Nộp bài thành công! Phản hồi từ Server:', submitData);
      
      console.log('Đang chờ hệ thống AI (NLP) chấm điểm tự luận (5s)...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check the DB for the essay score
      const { rows: essayScore } = await client.query('SELECT auto_score, similarity_score FROM submission_answers WHERE submission_id = $1 AND question_id = $2', [submission_id, q3[0].id]);
      console.log('Kết quả chấm tự luận NLP (từ DB):', essayScore[0]);

    } catch (apiError) {
      console.error('Lỗi API Nộp bài:', apiError.message);
    }

  } catch (err) {
    console.error('Lỗi Test Workflow:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
