import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="card mx-auto max-w-2xl text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-brand-500">404</p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-900">Không tìm thấy trang</h1>
      <p className="mt-3 text-slate-600">Trang bạn đang cố gắng truy cập không tồn tại hoặc đã được di chuyển.</p>
      <Link to="/dashboard" className="mt-6 inline-flex rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600">
        Về trang chủ
      </Link>
    </div>
  );
};

export default NotFound;
