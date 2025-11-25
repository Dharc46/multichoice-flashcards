# Multichoice Flashcards

Ứng dụng web đơn giản giúp bạn tạo nhiều gói câu hỏi với dạng trắc nghiệm và luyện tập mọi lúc ngay trong trình duyệt. Mỗi gói chứa nhiều câu hỏi, mỗi câu hỏi có tối thiểu hai đáp án và chính xác một đáp án đúng. Ứng dụng lưu dữ liệu cục bộ bằng `localStorage`, vì vậy bạn có thể quay lại và tiếp tục luyện tập khi mở lại trình duyệt.

## Tính năng chính

- **Quản lý gói câu hỏi**: tạo, đặt tên và xoá gói.
- **Thêm câu hỏi đa lựa chọn**: nhập nội dung câu hỏi, tối đa 6 đáp án và đánh dấu đáp án đúng.
- **Luyện tập ngẫu nhiên**: câu hỏi và đáp án được xáo trộn khi bắt đầu phiên luyện tập.
- **Phản hồi tức thời**: hiển thị đúng/sai cho từng lựa chọn và tổng kết khi hoàn thành.
- **Lưu cục bộ**: mọi dữ liệu được lưu trong trình duyệt, không cần backend.
- **Mẫu dữ liệu**: tự động sinh một gói ví dụ để bạn thử ngay.

## Cấu trúc dự án

```
multichoice-flashcards/
├── index.html     # giao diện và template chính
├── styles.css     # phong cách hiện đại, responsive
└── script.js      # logic quản lý gói, câu hỏi, và phiên luyện tập
```

## Cách chạy

Ứng dụng chỉ cần một server tĩnh (hoặc mở trực tiếp). Tuy nhiên do `script.js` sử dụng `type="module"`, bạn nên chạy qua HTTP để tránh lỗi CORS.

### Cách 1: Live Server trong VS Code
1. Cài extension **Live Server**.
2. Mở file `index.html` và bấm **Go Live**.
3. Trình duyệt sẽ mở `http://127.0.0.1:5500/index.html` (hoặc tương tự).

### Cách 2: Dùng Node.js (`npx serve`)
```bash
cd c:\Users\khoil\forWork\multichoice-flashcards
npx serve .
```
Mở URL hiển thị trong terminal (thường là `http://localhost:3000`).

### Cách 3: Python HTTP server
```bash
cd c:\Users\khoil\forWork\multichoice-flashcards
python -m http.server 5500
```
Truy cập `http://localhost:5500`.

