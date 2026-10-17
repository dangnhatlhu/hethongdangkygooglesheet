const CONFIG = Object.freeze({
  SPREADSHEET_ID: "1p3PTm0BnIm0HuXLfHYEAAscknXWrowzSCcUpnyNuMfM",
  SHEET_NAME: "Trang tính1",
  CAPACITY: 50,
  EVENT_NAME: "Ngày hội Công nghệ & Đổi mới sáng tạo 2026",
  EVENT_DATE: "Thứ Bảy, 14/11/2026",
  EVENT_LOCATION: "Innovation Hub, TP. Hồ Chí Minh"
});

const HEADERS = [
  "Thời gian đăng ký",
  "Mã đăng ký",
  "Họ và tên",
  "Email",
  "Số điện thoại",
  "Ghi chú"
];

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: "event-registration",
      message: "Web App đang hoạt động. Frontend gửi yêu cầu bằng POST."
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const transportId = e && e.parameter ? String(e.parameter.transportId || "") : "";
  let result;

  try {
    const rawPayload = e && e.parameter ? e.parameter.payload : "";
    const payload = JSON.parse(rawPayload || "{}");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw apiError_("INVALID_REQUEST", "Dữ liệu yêu cầu không hợp lệ.");
    }

    if (payload.action === "availability") {
      result = getAvailability_();
    } else if (payload.action === "register") {
      result = register_(payload);
    } else {
      throw apiError_("INVALID_ACTION", "Thao tác yêu cầu không được hỗ trợ.");
    }
  } catch (error) {
    const code = error && error.code ? error.code : "SERVER_ERROR";
    const message = error && error.message
      ? error.message
      : "Đã xảy ra lỗi máy chủ. Vui lòng thử lại.";
    if (code === "SERVER_ERROR") Logger.log("Event API error: " + message);
    result = {
      ok: false,
      code: code,
      message: message
    };
    if (error && error.field) result.field = error.field;
  }

  return createMessagePage_(transportId, result);
}

function setupSheet() {
  const sheet = getSheet_();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#eaf0ff");
  if (sheet.getMaxRows() > 1) sheet.getRange(2, 2, sheet.getMaxRows() - 1, 5).setNumberFormat("@");
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 270);
  sheet.setColumnWidth(3, 190);
  sheet.setColumnWidth(4, 230);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 300);
  return "Đã kiểm tra và thiết lập Sheet: " + CONFIG.SHEET_NAME;
}

function testConnection() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error("Không thể kiểm tra Sheet vì đang có yêu cầu khác.");
  }
  try {
    const sheet = getSheet_();
    const registered = countValidRegistrations_(sheet);
    return {
      ok: true,
      spreadsheetName: getSpreadsheet_().getName(),
      sheetName: sheet.getName(),
      registered: registered,
      capacity: CONFIG.CAPACITY,
      remaining: Math.max(0, CONFIG.CAPACITY - registered)
    };
  } finally {
    lock.releaseLock();
  }
}

function authorizeEmail() {
  const remainingQuota = MailApp.getRemainingDailyQuota();
  return "Quyền gửi email đã được cấp. Hạn mức người nhận còn lại hôm nay: " + remainingQuota;
}

function getAvailability_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw apiError_("BUSY", "Máy chủ đang bận. Vui lòng thử tải lại số chỗ.");
  }
  try {
    const registered = countValidRegistrations_(getSheet_());
    return {
      ok: true,
      capacity: CONFIG.CAPACITY,
      registered: registered,
      remaining: Math.max(0, CONFIG.CAPACITY - registered),
      full: registered >= CONFIG.CAPACITY
    };
  } finally {
    lock.releaseLock();
  }
}

function register_(payload) {
  const requestId = String(payload.requestId || "");
  if (!isValidRequestId_(requestId)) {
    throw apiError_("VALIDATION_ERROR", "Mã yêu cầu không hợp lệ. Hãy tải lại trang và thử lại.");
  }
  const registration = normalizeAndValidateRegistration_(payload.registration);
  const fingerprint = registrationFingerprint_(registration);
  const registrationId = "DK-" + requestId.toUpperCase();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw apiError_("BUSY", "Máy chủ đang xử lý nhiều yêu cầu. Vui lòng thử lại sau.");
  }

  let savedRegistration;
  let duplicate = false;
  let emailStatus = "pending";
  let remaining;
  try {
    const sheet = getSheet_();
    const properties = PropertiesService.getScriptProperties();
    const propertyKey = idempotencyPropertyKey_(requestId);
    const savedProperty = properties.getProperty(propertyKey);
    const existingRow = findRegistrationRow_(sheet, registrationId);

    if (existingRow) {
      const previous = savedProperty ? JSON.parse(savedProperty) : null;
      const existingFingerprint = previous && previous.fingerprint
        ? previous.fingerprint
        : registrationFingerprint_(registrationFromRow_(existingRow.values));
      if (existingFingerprint !== fingerprint) {
        throw apiError_("IDEMPOTENCY_CONFLICT", "Yêu cầu này đã được dùng cho thông tin khác. Tải lại trang trước khi gửi thông tin mới.");
      }

      duplicate = true;
      emailStatus = previous && previous.emailStatus ? previous.emailStatus : "unknown";
      savedRegistration = {
        registrationId: registrationId,
        registeredAt: formatRegisteredAt_(existingRow.values[0]),
        fullName: registration.fullName,
        email: registration.email
      };
    } else {
      const registered = countValidRegistrations_(sheet);
      if (registered >= CONFIG.CAPACITY) {
        throw apiError_("FULL", "Sự kiện đã đủ 50 người đăng ký. Rất tiếc, hiện không thể nhận thêm đăng ký.");
      }

      const now = new Date();
      appendRegistration_(sheet, registrationId, registration, now);
      savedRegistration = {
        registrationId: registrationId,
        registeredAt: formatRegisteredAt_(now),
        fullName: registration.fullName,
        email: registration.email
      };
      properties.setProperty(propertyKey, JSON.stringify({
        fingerprint: fingerprint,
        emailStatus: "pending"
      }));
      remaining = Math.max(0, CONFIG.CAPACITY - registered - 1);
    }
  } finally {
    lock.releaseLock();
  }

  if (!duplicate) {
    try {
      sendConfirmationEmail_(savedRegistration);
      emailStatus = "sent";
    } catch (error) {
      emailStatus = "failed";
      Logger.log("Confirmation email failed for " + registrationId + ": " + error.message);
    }
    PropertiesService.getScriptProperties().setProperty(
      idempotencyPropertyKey_(requestId),
      JSON.stringify({ fingerprint: fingerprint, emailStatus: emailStatus })
    );
  }

  const availability = getAvailability_();
  return {
    ok: true,
    duplicate: duplicate,
    registrationId: savedRegistration.registrationId,
    registeredAt: savedRegistration.registeredAt,
    emailSent: emailStatus === "sent",
    emailStatus: emailStatus,
    remaining: typeof remaining === "number" ? remaining : availability.remaining,
    capacity: CONFIG.CAPACITY
  };
}

function normalizeAndValidateRegistration_(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw apiError_("VALIDATION_ERROR", "Thông tin đăng ký không hợp lệ.");
  }
  if (typeof input.fullName !== "string") {
    throw fieldError_("name", "Vui lòng nhập họ tên bằng văn bản.");
  }
  if (typeof input.email !== "string") {
    throw fieldError_("email", "Vui lòng nhập email bằng văn bản.");
  }
  if (typeof input.phone !== "string") {
    throw fieldError_("phone", "Vui lòng nhập số điện thoại bằng văn bản.");
  }
  if (typeof input.note !== "string" && typeof input.note !== "undefined" && input.note !== null) {
    throw fieldError_("note", "Ghi chú phải là văn bản.");
  }

  const registration = {
    fullName: normalizeWhitespace_(input.fullName),
    email: normalizeWhitespace_(input.email).toLowerCase(),
    phone: normalizeWhitespace_(input.phone),
    note: normalizeWhitespace_(input.note)
  };

  if (!registration.fullName || registration.fullName.length > 120) {
    throw fieldError_("name", "Vui lòng nhập họ tên (tối đa 120 ký tự).");
  }
  if (registration.fullName.indexOf("\u0000") !== -1) {
    throw fieldError_("name", "Họ tên chứa ký tự không hợp lệ.");
  }
  if (registration.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(registration.email)) {
    throw fieldError_("email", "Vui lòng nhập địa chỉ email hợp lệ.");
  }
  if (!/^0\d{9}$/.test(registration.phone)) {
    throw fieldError_("phone", "Số điện thoại cần có 10 chữ số và bắt đầu bằng số 0.");
  }
  if (registration.note.length > 1000) {
    throw fieldError_("note", "Ghi chú không được vượt quá 1000 ký tự.");
  }

  return registration;
}

function normalizeWhitespace_(value) {
  return String(value === null || typeof value === "undefined" ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function registrationFingerprint_(registration) {
  return JSON.stringify([
    registration.fullName,
    registration.email,
    registration.phone,
    registration.note
  ]);
}

function isValidRequestId_(requestId) {
  return /^[0-9a-f]{32}$/i.test(requestId) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
}

function idempotencyPropertyKey_(requestId) {
  return "registration:" + requestId.toLowerCase();
}

function getSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === "PASTE_SPREADSHEET_ID_HERE") {
    throw new Error("Chưa cấu hình SPREADSHEET_ID trong Code.gs.");
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#eaf0ff");
    if (sheet.getMaxRows() > 1) {
      sheet.getRange(2, 2, sheet.getMaxRows() - 1, 5).setNumberFormat("@");
    }
  }
  const actualHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (HEADERS.some(function (header, index) {
    return actualHeaders[index] !== header;
  })) {
    throw new Error("Tiêu đề tab '" + CONFIG.SHEET_NAME + "' không khớp. Cần 6 cột: " + HEADERS.join(" | "));
  }
  return sheet;
}

function appendRegistration_(sheet, registrationId, registration, registeredAt) {
  const rowNumber = Math.max(2, sheet.getLastRow() + 1);
  sheet.getRange(rowNumber, 2, 1, 5).setNumberFormat("@");
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([[
    registeredAt,
    registrationId,
    safeSheetText_(registration.fullName),
    safeSheetText_(registration.email),
    safeSheetText_(registration.phone),
    safeSheetText_(registration.note)
  ]]);
}

function safeSheetText_(value) {
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function countValidRegistrations_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues()
    .filter(function (row) {
      return isValidStoredRegistration_(row);
    }).length;
}

function isValidStoredRegistration_(row) {
  const registrationId = String(row[1] || "");
  const fullName = unescapeSheetText_(String(row[2] || ""));
  const email = unescapeSheetText_(String(row[3] || ""));
  const phone = unescapeSheetText_(String(row[4] || ""));
  return /^DK-[0-9A-F-]{32,36}$/.test(registrationId) &&
    fullName.length > 0 && fullName.length <= 120 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) &&
    /^0\d{9}$/.test(phone) &&
    row[0] !== "" && row[0] !== null;
}

function unescapeSheetText_(value) {
  return /^'[\s]*[=+\-@]/.test(value) ? value.slice(1) : value;
}

function findRegistrationRow_(sheet, registrationId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][1] || "") === registrationId) {
      return { rowNumber: index + 2, values: values[index] };
    }
  }
  return null;
}

function registrationFromRow_(row) {
  return {
    fullName: normalizeWhitespace_(unescapeSheetText_(String(row[2] || ""))),
    email: normalizeWhitespace_(unescapeSheetText_(String(row[3] || ""))).toLowerCase(),
    phone: normalizeWhitespace_(unescapeSheetText_(String(row[4] || ""))),
    note: normalizeWhitespace_(unescapeSheetText_(String(row[5] || "")))
  };
}

function formatRegisteredAt_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime())
    ? String(value || "")
    : Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
}

function sendConfirmationEmail_(registration) {
  const subject = "Xác nhận đăng ký: " + CONFIG.EVENT_NAME;
  const body = [
    "Chào " + registration.fullName + ",",
    "",
    "Cảm ơn bạn đã đăng ký tham gia " + CONFIG.EVENT_NAME + ".",
    "Thời gian: " + CONFIG.EVENT_DATE,
    "Địa điểm: " + CONFIG.EVENT_LOCATION,
    "Mã đăng ký: " + registration.registrationId,
    "",
    "Vui lòng lưu mã đăng ký để check-in tại sự kiện.",
    "Hẹn gặp bạn!"
  ].join("\n");
  const htmlBody = [
    "<p>Chào " + escapeHtml_(registration.fullName) + ",</p>",
    "<p>Cảm ơn bạn đã đăng ký tham gia <strong>" + escapeHtml_(CONFIG.EVENT_NAME) + "</strong>.</p>",
    "<p><strong>Thời gian:</strong> " + escapeHtml_(CONFIG.EVENT_DATE) + "<br>",
    "<strong>Địa điểm:</strong> " + escapeHtml_(CONFIG.EVENT_LOCATION) + "<br>",
    "<strong>Mã đăng ký:</strong> " + escapeHtml_(registration.registrationId) + "</p>",
    "<p>Vui lòng lưu mã đăng ký để check-in tại sự kiện. Hẹn gặp bạn!</p>"
  ].join("");
  MailApp.sendEmail({
    to: registration.email,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    name: "Ban tổ chức sự kiện"
  });
}

function escapeHtml_(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function fieldError_(field, message) {
  const error = apiError_("VALIDATION_ERROR", message);
  error.field = field;
  return error;
}

function apiError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createMessagePage_(transportId, result) {
  const message = JSON.stringify({
    channel: "event-registration-response",
    requestId: transportId,
    result: result
  }).replace(/</g, "\\u003c");
  const html = [
    "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>",
    "<script>window.parent.postMessage(",
    message,
    ", '*');</script>",
    "</body></html>"
  ].join("");
  return HtmlService.createHtmlOutput(html)
    .setTitle("Kết quả đăng ký")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
