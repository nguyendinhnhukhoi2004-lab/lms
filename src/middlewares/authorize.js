// middlewares/authorize.js
// Middleware phân quyền theo vai trò (RBAC — Role-Based Access Control)
// Dùng SAU authenticate: chỉ chạy khi đã xác thực xong
//
// Cách dùng trong route:
//   router.get('/users', authenticate, authorize('admin'), getAllUsers)
//   router.post('/questions', authenticate, authorize('teacher','department_head'), createQuestion)

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user được gắn bởi middleware authenticate trước đó
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực' });
    }

    const { role } = req.user;

    // Kiểm tra xem role của user có trong danh sách được phép không
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        message: `Bạn không có quyền thực hiện hành động này. Yêu cầu: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
};

module.exports = { authorize };
