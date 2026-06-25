const GradesModel = require('../models/grades.model');
const ClassModel = require('../models/class.model');

// GET /api/grades/class-subject/:id
// Lấy sổ điểm của một môn trong lớp hành chính (Dành cho GVBM)
const getClassSubjectGrades = async (req, res) => {
  try {
    const grades = await GradesModel.getClassSubjectGrades(req.params.id);
    return res.status(200).json({ grades });
  } catch (err) {
    console.error('getClassSubjectGrades error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/grades/homeroom/:id
// Lấy bảng điểm tổng hợp của lớp hành chính (Dành cho GVCN)
const getHomeroomGrades = async (req, res) => {
  try {
    const classInfo = await ClassModel.findById(req.params.id);
    if (!classInfo) {
      return res.status(404).json({ message: 'Không tìm thấy lớp' });
    }

    // Kiểm tra quyền: Chỉ admin, tổ trưởng, hoặc GVCN của lớp này mới được xem
    if (req.user.role === 'teacher' && classInfo.homeroom_teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Bạn không phải là Giáo viên Chủ nhiệm của lớp này' });
    }

    const data = await GradesModel.getHomeroomGradeMatrix(req.params.id);
    return res.status(200).json(data);
  } catch (err) {
    console.error('getHomeroomGrades error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = {
  getClassSubjectGrades,
  getHomeroomGrades
};
