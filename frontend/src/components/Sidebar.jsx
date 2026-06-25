import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const Sidebar = ({ sections }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenus, setOpenMenus] = useState({});

  const toggleMenu = (label) => setOpenMenus(p => ({ ...p, [label]: !p[label] }));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = {
    admin: 'Quản trị viên',
    department_head: 'Tổ trưởng',
    teacher: 'Giáo viên',
    student: 'Học sinh',
  }[user?.role] || user?.role || '';

  return (
    <aside className="w-full border-b border-slate-200 bg-white md:w-64 md:shrink-0 md:border-r md:border-b-0 flex flex-col md:sticky md:top-0 md:h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">Hệ thống thi trực tuyến</p>
        <h2 className="mt-0.5 text-lg font-bold text-slate-800">THPT Smart LMS</h2>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {sections.map((section) => {
          if (section.children) {
            const isActive = section.children.some(c => location.pathname === c.path);
            const isOpen = openMenus[section.label] ?? isActive;

            return (
              <div key={section.label}>
                <button
                  onClick={() => toggleMenu(section.label)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {section.icon && (
                    <span className={`shrink-0 ${isActive ? 'text-slate-700' : 'text-slate-400'}`}>
                      {section.icon}
                    </span>
                  )}
                  <span className="flex-1 text-left">{section.label}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="ml-4 mt-0.5 mb-1 border-l border-slate-100 pl-3 space-y-0.5">
                    {section.children.filter(child => child.label !== 'Lớp học phần').map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive: childActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            childActive
                              ? 'bg-slate-900 text-white font-medium'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          }`
                        }
                      >
                        {child.icon && (
                          <span className="shrink-0 opacity-70">{child.icon}</span>
                        )}
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={section.path || section.label}
              to={section.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`
              }
            >
              {section.icon && (
                <span className="shrink-0">{section.icon}</span>
              )}
              {section.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User info + actions */}
      <div className="shrink-0 border-t border-slate-100 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-800">{user?.full_name || user?.email || 'Người dùng'}</p>
            <p className="text-[11px] text-slate-400">{roleLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/profile')}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Hồ sơ
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
