import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

const Profile = () => {
  const { user } = useAuth();
  
  const [passwords, setPasswords] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const roleLabel = {
    admin: 'Quản trị viên',
    department_head: 'Tổ trưởng',
    teacher: 'Giáo viên',
    student: 'Học sinh',
  }[user?.role] || user?.role;

  const handleChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwords.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({
        old_password: passwords.oldPassword,
        new_password: passwords.newPassword,
      });
      setSuccess('Đổi mật khẩu thành công!');
      setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Thông tin hồ sơ */}
      <div className="rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Hồ sơ cá nhân</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-sm text-slate-500 font-medium">Họ và tên</p>
            <p className="text-base font-semibold text-slate-900">{user?.full_name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500 font-medium">Email</p>
            <p className="text-base font-semibold text-slate-900">{user?.email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-slate-500 font-medium">Vai trò</p>
            <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              {roleLabel}
            </span>
          </div>
          {user?.class_name && (
            <div className="space-y-1">
              <p className="text-sm text-slate-500 font-medium">Lớp học</p>
              <p className="text-base font-semibold text-slate-900">{user.class_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Đổi mật khẩu */}
      <div className="rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Đổi mật khẩu</h2>
        
        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-green-50 p-4 text-sm text-green-600">
              {success}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Mật khẩu hiện tại</label>
            <input
              type="password"
              name="oldPassword"
              value={passwords.oldPassword}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Nhập mật khẩu cũ"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Mật khẩu mới</label>
            <input
              type="password"
              name="newPassword"
              value={passwords.newPassword}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Mật khẩu ít nhất 6 ký tự"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              name="confirmPassword"
              value={passwords.confirmPassword}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50 mt-4 w-full md:w-auto"
          >
            {loading ? 'Đang xử lý...' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
