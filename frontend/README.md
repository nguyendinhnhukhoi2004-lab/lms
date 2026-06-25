# Frontend - React.js + Tailwind CSS

## Cài đặt

```bash
cd frontend
npm install
cp .env.example .env
```

## Chạy dev

```bash
npm run dev
```

Frontend sẽ mở ở `http://localhost:5173`

## Build production

```bash
npm run build
npm run preview
```

## Tính năng đã triển khai

✅ Đăng nhập jwt + authentication
✅ Protected routes — chỉ người dùng đã đăng nhập mới vào được
✅ API client — giao tiếp với backend Node.js
✅ Quản lý state authentication qua context
✅ Form tạo/chỉnh sửa câu hỏi
✅ Form tạo/chỉnh sửa đề thi
✅ CRUD cho question bank
✅ CRUD cho exam management
✅ Responsive design — mobile + desktop
✅ Tailwind CSS + custom theme (xanh + vàng)

## Tài khoản demo

```
Email: teacher@exam.local
Password: password
```

Bạn có thể tạo tài khoản mới từ backend hoặc dùng tài khoản này để test.

## Cấu trúc thư mục

```
frontend/
├── src/
│   ├── components/      # Các component tái sử dụng
│   ├── context/         # Auth context
│   ├── pages/           # Các trang của app
│   ├── services/        # API client
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
├── tailwind.config.js
├── vite.config.js
└── index.html
```
