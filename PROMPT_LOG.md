# Nhật ký yêu cầu và triển khai

## Yêu cầu ban đầu

> Xây dựng hệ thống đăng ký sự kiện tích hợp Google Sheets bằng HTML5, CSS3, JavaScript thuần và Google Apps Script. Giao diện tiếng Việt responsive; form có Họ và tên, Email, Số điện thoại, Ghi chú; validation realtime; gửi bất đồng bộ, trạng thái loading, modal xác nhận và QR. Apps Script kiểm tra dữ liệu và lưu 6 cột, gửi email, đếm tối đa 50 người với LockService, chống gửi trùng, trả số chỗ. Cung cấp cấu hình, README triển khai và kiểm tra; không giả mạo kết quả thành công và không dùng fetch no-cors.

## Tóm tắt triển khai

- Tạo giao diện sự kiện responsive với Roboto, thông tin sự kiện, chỗ còn lại, biểu mẫu có thông báo lỗi và modal xác nhận.
- Thêm kiểm tra dữ liệu ở frontend lẫn Apps Script; chuẩn hóa khoảng trắng và giữ số điện thoại dưới dạng văn bản.
- Kết nối frontend với Apps Script bằng form POST ẩn/iframe và `postMessage` để xác nhận phản hồi xuyên miền; không dùng `fetch` `no-cors`.
- Ghi dữ liệu đúng 6 cột; dùng `LockService` khi kiểm tra và ghi để giới hạn sức chứa, lưu mã yêu cầu ổn định để chống đăng ký trùng.
- Gửi email sau khi lưu; lỗi email không xóa bản ghi và không biến kết quả lưu thành thất bại.
- Tạo QR bằng QuickChart sau phản hồi lưu thành công; có nội dung dự phòng nếu QR không tải.
- Ghi hướng dẫn cấu hình, triển khai, cấp quyền và checklist kiểm tra trong `README.md`.
- Cập nhật Spreadsheet ID theo Google Sheet người dùng cung cấp; ẩn cảnh báo cấu hình khỏi giao diện ban đầu và hiển thị dấu gạch ngang thay vì số chỗ chưa xác minh.
- Rà soát luồng gửi lại và bổ sung `transportId` vào POST để frontend ghép được phản hồi Apps Script; bổ sung manifest Web App, tự tạo header khi tab rỗng, và hàm `testConnection()` để chẩn đoán tích hợp.
- Thêm link mở trực tiếp Google Sheet trên giao diện và thông báo rõ rằng URL Sheet đã cấu hình nhưng Web App `/exec` vẫn cần được triển khai riêng để ghi dữ liệu.
