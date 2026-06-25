const { query } = require('../config/db');

// Lấy danh sách phòng thi của một bài kiểm tra
const findByExamId = async (examId) => {
  const { rows } = await query(
    `SELECT er.id, er.exam_id, er.name, er.capacity, er.created_at,
            COUNT(ers.student_id)::int AS student_count
     FROM exam_rooms er
     LEFT JOIN exam_room_students ers ON ers.room_id = er.id
     WHERE er.exam_id = $1
     GROUP BY er.id
     ORDER BY er.name`,
    [examId]
  );
  return rows;
};

// Lấy danh sách học sinh trong một phòng thi
const findStudentsByRoomId = async (roomId) => {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.class_id, ers.sbd, ers.seat_number
     FROM exam_room_students ers
     JOIN users u ON u.id = ers.student_id
     WHERE ers.room_id = $1
     ORDER BY ers.sbd`,
    [roomId]
  );
  return rows;
};

// Thuật toán trộn phòng thi động
const generateRooms = async (examId, subjectId) => {
  // 1. Lấy toàn bộ học sinh đăng ký môn học này (thông qua lớp hành chính)
  const { rows: students } = await query(
    `SELECT u.id, u.full_name
     FROM class_subjects cs
     JOIN users u ON u.class_id = cs.class_id
     WHERE cs.subject_id = $1 AND u.role = 'student'
     ORDER BY u.full_name ASC`,
    [subjectId]
  );

  if (students.length === 0) {
    throw new Error('Không có học sinh nào đăng ký môn học này');
  }

  // 2. Xóa các phòng thi cũ nếu có
  await query('DELETE FROM exam_rooms WHERE exam_id = $1', [examId]);

  const capacity = 24; // Mỗi phòng 24 học sinh
  let roomIndex = 1;
  let currentRoomStudents = [];
  
  // Chunk học sinh vào từng phòng
  for (let i = 0; i < students.length; i++) {
    currentRoomStudents.push(students[i]);
    
    // Đủ 24 học sinh hoặc là học sinh cuối cùng thì tạo phòng
    if (currentRoomStudents.length === capacity || i === students.length - 1) {
      const roomName = `Phòng ${String(roomIndex).padStart(2, '0')}`;
      
      // Tạo phòng
      const { rows: roomRows } = await query(
        `INSERT INTO exam_rooms (exam_id, name, capacity)
         VALUES ($1, $2, $3) RETURNING id`,
        [examId, roomName, capacity]
      );
      const roomId = roomRows[0].id;

      // Xếp học sinh vào phòng và sinh SBD, Số ghế
      const insertPromises = currentRoomStudents.map((student, index) => {
        const sbd = `SBD${String(i - currentRoomStudents.length + 1 + index + 1).padStart(4, '0')}`;
        const seatNumber = index + 1;
        
        return query(
          `INSERT INTO exam_room_students (room_id, student_id, sbd, seat_number)
           VALUES ($1, $2, $3, $4)`,
          [roomId, student.id, sbd, seatNumber]
        );
      });
      
      await Promise.all(insertPromises);
      
      currentRoomStudents = [];
      roomIndex++;
    }
  }

  return { message: 'Đã xếp phòng thi thành công', total_students: students.length, total_rooms: roomIndex - 1 };
};

module.exports = {
  findByExamId,
  findStudentsByRoomId,
  generateRooms
};
