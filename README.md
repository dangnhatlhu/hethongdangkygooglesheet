# Hệ thống đăng ký sự kiện tích hợp Google Sheets

Ứng dụng đăng ký một trang, viết bằng HTML5, CSS3, JavaScript thuần và Google Apps Script. Frontend kiểm tra dữ liệu, hiển thị số chỗ còn lại, gửi đăng ký lên Web App; Apps Script kiểm tra lại, chống đăng ký trùng, khóa đồng thời, lưu Google Sheets và gửi email xác nhận.

## Cấu trúc

```text
index.html
style.css
script.js
config.js
google-apps-script/
  Code.gs
README.md
PROMPT_LOG.md
```

## Có thể chạy ngay và phần cần cấu hình

- Có thể mở trang bằng VS Code Live Server để xem giao diện và validation phía trình duyệt. Khi chưa kết nối được Web App, số chỗ hiển thị dấu gạch ngang thay vì số liệu giả; đăng ký không được báo thành công nếu máy chủ chưa xác nhận.
- Đã điền Spreadsheet ID và link mở [Google Sheet bạn cung cấp](https://docs.google.com/spreadsheets/d/1p3PTm0BnIm0HuXLfHYEAAscknXWrowzSCcUpnyNuMfM/edit). Form vẫn cần URL Apps Script Web App `/exec` trong `config.js`; link trang tính không thể tự nhận dữ liệu gửi.
- Font Roboto và ảnh QR QuickChart cần kết nối Internet. Mã QR chỉ được tải sau khi máy chủ xác nhận lưu thành công.

## Cài đặt Google Sheets và Apps Script

1. Mở [Google Sheet đã cung cấp](https://docs.google.com/spreadsheets/d/1p3PTm0BnIm0HuXLfHYEAAscknXWrowzSCcUpnyNuMfM/edit). Nếu bạn không có quyền chỉnh sửa, yêu cầu quyền từ chủ sở hữu trước khi tiếp tục.
2. Mở **Extensions (Tiện ích mở rộng) → Apps Script** trong Sheet đó. Tài khoản triển khai phải có quyền chỉnh sửa Sheet; link công khai chế độ chỉ xem không đủ để chạy Apps Script.
3. Dán toàn bộ `google-apps-script/Code.gs` vào dự án Apps Script. Mở **Project Settings** và bật **Show "appsscript.json" manifest file in editor**; thay nội dung manifest bằng `google-apps-script/appsscript.json`.
4. Trong phần `CONFIG` đầu `Code.gs`, sửa:
   - `SPREADSHEET_ID`: đã cấu hình thành `1p3PTm0BnIm0HuXLfHYEAAscknXWrowzSCcUpnyNuMfM`.
   - `SHEET_NAME`: đã cấu hình thành `Trang tính1`, tên tab hiện có trong Sheet bạn gửi.
   - `CAPACITY`: mặc định 50.
   - `EVENT_NAME`, `EVENT_DATE`, `EVENT_LOCATION`: nội dung đưa vào email xác nhận. Sửa tương ứng phần `event` trong `config.js` để nội dung trên trang khớp với email.
5. Lưu Apps Script. Trong danh sách hàm phía trên trình soạn thảo, chọn `setupSheet` rồi bấm **Run**. Chấp thuận quyền truy cập Google Sheets. Hàm tạo tab nếu chưa có, tạo/kiểm tra đúng 6 cột và định dạng các cột thông tin dạng văn bản. Có thể chạy `testConnection()` để xác nhận đúng tên file, tab và số chỗ.

   Tiêu đề cột bắt buộc theo đúng thứ tự:

   | A | B | C | D | E | F |
   |---|---|---|---|---|---|
   | Thời gian đăng ký | Mã đăng ký | Họ và tên | Email | Số điện thoại | Ghi chú |

6. Chọn hàm `authorizeEmail` rồi bấm **Run** và chấp thuận quyền gửi email. Hàm chỉ kiểm tra hạn mức gửi, không gửi thư thử nghiệm. Email được gửi sau khi bản ghi được lưu.
7. Chọn **Deploy → New deployment**. Chọn loại **Web app**:
   - **Execute as:** Me (tài khoản đang triển khai, phải có quyền chỉnh sửa Spreadsheet).
   - **Who has access:** Anyone, kể cả người chưa đăng nhập Google (manifest đặt `ANYONE_ANONYMOUS`; nếu Workspace chặn truy cập ẩn danh, cần đổi chính sách Workspace hoặc dùng tài khoản được phép triển khai công khai).
8. Bấm **Deploy**, hoàn tất xác thực nếu được hỏi, rồi sao chép URL Web App kết thúc bằng `/exec`. Không dùng URL `/dev` để chạy ứng dụng cho người tham dự.
9. Mở `config.js`, gán URL vừa sao chép cho `apiUrl`, ví dụ. URL Google Sheets ở trên là nơi lưu dữ liệu, không thay thế URL Web App `/exec`:

   ```js
   apiUrl: "https://script.google.com/macros/s/ID_BAN_TRIEN_KHAI/exec",
   ```

   URL Web App là địa chỉ công khai để gọi API, không phải thông tin xác thực bí mật. Spreadsheet ID chỉ được đặt trong Apps Script, không đặt trong frontend.
10. Nếu sửa `Code.gs` sau khi triển khai: **Deploy → Manage deployments → Edit (biểu tượng bút chì) → Version → New version → Deploy**. URL `/exec` thường giữ nguyên; nếu tạo deployment mới, cập nhật lại `config.js`.

**Bảo vệ dữ liệu cá nhân:** liên kết Sheet hiện cho phép người có đường liên kết xem. Sheet lưu họ tên, email và số điện thoại; hãy vào **Chia sẻ → Quyền truy cập chung** và đổi thành **Bị hạn chế**. Web App vẫn có thể ghi Sheet khi triển khai bằng tài khoản chủ sở hữu (`Execute as: Me`); không cần công khai Sheet để nối ứng dụng.

## Chạy frontend

1. Mở thư mục dự án trong VS Code.
2. Cài extension **Live Server** nếu chưa có.
3. Nhấp phải `index.html` → **Open with Live Server**.
4. Mở Developer Tools nếu cần kiểm tra lỗi. Hãy xác nhận số chỗ tải được từ Sheets trước khi thử đăng ký thật.

Không mở trang trực tiếp bằng `file://`; chạy qua Live Server hoặc máy chủ tĩnh HTTPS. Không cần Node.js, framework hay bước build.

## Cách kết nối, CORS và xác nhận lưu

Trình duyệt gửi một form `POST` ẩn đến Apps Script trong iframe, kèm cả dữ liệu `payload` và `transportId`, rồi nhận kết quả có cấu trúc qua `window.postMessage`. `transportId` ghép phản hồi iframe với đúng yêu cầu đang chờ; thiếu tham số này thì trang không thể nhận phản hồi và không thể hiện số chỗ hoặc xác nhận đăng ký. Form gửi `application/x-www-form-urlencoded`, không cần preflight CORS; phản hồi HTML của Apps Script có thể được chuyển hướng nội bộ sang miền `googleusercontent.com`, và frontend chỉ nhận thông báo từ đúng iframe, từ HTTPS trên miền Google được cho phép. Mỗi thông điệp còn được đối chiếu với mã yêu cầu tạm thời.

Cách này không đọc nội dung cross-origin bằng `fetch`, cũng không dùng `mode: "no-cors"` hoặc coi phản hồi opaque là thành công. Frontend chỉ mở hộp xác nhận và xóa dữ liệu sau phản hồi `ok: true` có mã đăng ký và thời gian lưu. Nếu quá thời gian hoặc mất mạng, dữ liệu được giữ lại để thử lại. Mã yêu cầu đăng ký được giữ trong `sessionStorage`; gửi lại cùng payload sẽ dùng lại mã này và Apps Script trả bản ghi cũ thay vì thêm hàng thứ hai.

Nếu iframe hết thời gian hoặc trang không nhận được phản hồi, kiểm tra lại quyền truy cập Web App là **Anyone**, URL `/exec`, trạng thái deployment và chính sách truy cập Google Workspace. Việc chia sẻ Spreadsheet không cần công khai: Web App chạy dưới quyền chủ sở hữu.

### Kiểm tra nhanh nếu giao diện chưa liên hệ được Sheet

1. Trong `config.js`, `apiUrl` phải là URL Web App triển khai kết thúc bằng `/exec`; link Spreadsheet `/spreadsheets/d/.../edit` không phải URL API. `apiUrl` hiện để trống có chủ đích cho đến khi tạo deployment; form không thể gửi vào Sheet khi chưa có địa chỉ này.
2. Trong Apps Script, xác nhận `SPREADSHEET_ID` là `1p3PTm0BnIm0HuXLfHYEAAscknXWrowzSCcUpnyNuMfM`, `SHEET_NAME` là tab hiện có `Trang tính1` và tài khoản triển khai có quyền chỉnh sửa Google Sheet.
3. Chạy `setupSheet()` và `testConnection()` thành công, rồi triển khai Web App. Mở trực tiếp URL `/exec`; cần thấy phản hồi cho biết Web App đang hoạt động.
4. Dán URL `/exec` vào `apiUrl`, lưu `config.js`, tải lại trang bằng Live Server. Số chỗ chỉ hiện thành số sau khi yêu cầu `availability` nhận được phản hồi hợp lệ. Nếu còn `—`, kiểm tra Apps Script → **Executions**.
5. Sau mỗi lần cập nhật `Code.gs`, tạo **New version** cho deployment `/exec` hiện có. Chỉ lưu mã trong editor thôi chưa cập nhật bản Web App đã triển khai.

## Quy tắc dữ liệu và bảo vệ chỗ

- Họ tên được chuẩn hóa khoảng trắng, chỉ yêu cầu không rỗng (tối đa 120 ký tự), không áp quy tắc tên chỉ gồm chữ cái.
- Email được kiểm tra định dạng và chuẩn hóa chữ thường; số điện thoại là đúng 10 chữ số, bắt đầu bằng `0`.
- Apps Script kiểm tra lại dữ liệu, xác nhận đúng tiêu đề cột và lưu số điện thoại dạng văn bản để giữ số 0 đầu.
- Chỉ đếm hàng có mã đăng ký, thời gian, họ tên, email và số điện thoại hợp lệ; không đếm tiêu đề hoặc hàng rỗng.
- `LockService` khóa lúc kiểm tra số lượng và thêm hàng; khi chỉ còn một chỗ, chỉ một yêu cầu trong các yêu cầu đồng thời được chấp nhận.
- ID yêu cầu tạo mã đăng ký ổn định. Apps Script tra lại mã trước khi thêm hàng, kể cả khi client gửi lại do timeout/mất phản hồi.
- Sau khi thêm hàng, Apps Script gửi email. Nếu gửi email thất bại, bản ghi vẫn được giữ và phản hồi vẫn xác nhận đăng ký thành công nhưng báo tình trạng email để người tham gia không gửi lại đăng ký.
- QR QuickChart chứa họ tên và mã đăng ký; nội dung được URL-encode. Nếu ảnh không tải được, giao diện vẫn hiển thị mã đăng ký để check-in.
- Để tạo QR, họ tên và mã đăng ký được gửi đến dịch vụ QuickChart qua URL HTTPS; không đưa dữ liệu nhạy cảm khác vào nội dung QR.

## Kiểm tra trước khi nộp

### Kiểm tra trên giao diện (Live Server)

1. Để trống lần lượt Họ và tên, Email, Số điện thoại rồi gửi: lỗi hiện dưới trường tương ứng, không gửi form.
2. Nhập email sai định dạng, ví dụ `abc@`: báo lỗi email.
3. Nhập số điện thoại không đủ 10 số, không phải số, hoặc không bắt đầu bằng `0`: báo lỗi số điện thoại.
4. Nhập tên hợp lệ có dấu, tên có dấu cách; kiểm tra khoảng trắng đầu/cuối và nhiều khoảng trắng được chuẩn hóa.
5. Gửi liên tục/nhấp nhanh nút: nút khóa và hiện spinner “Đang gửi…”, chỉ phát sinh một yêu cầu đang chờ.
6. Ngắt mạng hoặc dùng URL Web App sai: hiện lỗi, không hiện modal thành công và dữ liệu vẫn còn trong form.

### Kiểm tra tích hợp thực (sau khi cấp quyền và triển khai)

1. Gửi đăng ký hợp lệ: xác nhận có đúng một hàng mới trong Sheets, đủ 6 cột, số điện thoại còn số `0` đầu; modal có mã đăng ký và QR; kiểm tra email đến (kể cả thư rác).
2. Mô phỏng gửi lại cùng yêu cầu: nếu máy chủ đã lưu nhưng client chưa nhận phản hồi, thử lại cùng payload trong cùng tab; số hàng không tăng và mã đăng ký không đổi. Không xóa session storage giữa phép thử.
3. Kiểm tra email lỗi: có thể tạm dùng địa chỉ không nhận thư hoặc tài khoản hết quota; xác nhận bản ghi vẫn có trong Sheets, giao diện báo email chưa gửi và không yêu cầu đăng ký lại.
4. Với môi trường kiểm thử riêng, thay `CAPACITY` thành số nhỏ như `2`; đăng ký đến ngưỡng rồi tải lại trang, số chỗ về 0 và form bị khóa. Trả `CAPACITY` về `50` trước khi nộp.
5. Để kiểm tra tranh chấp chỗ cuối, đặt `CAPACITY` bằng số bản ghi hợp lệ hiện có cộng `1`, sau đó gửi đồng thời ít nhất hai yêu cầu hợp lệ từ hai tab/thiết bị. Chỉ một yêu cầu được thêm; yêu cầu còn lại nhận `FULL`. Khôi phục `CAPACITY` về `50`.
6. Số chỗ được tải khi mở trang, làm mới sau đăng ký và cập nhật định kỳ mỗi 60 giây.

Không thể xác nhận quyền Google, kết nối Sheets, gửi email hoặc tranh chấp đồng thời nếu chưa điền cấu hình và chạy thử bằng tài khoản Google thực tế.
