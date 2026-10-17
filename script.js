(function () {
  "use strict";

  const config = window.EVENT_APP_CONFIG;
  const form = document.getElementById("registration-form");
  const submitButton = document.getElementById("submit-button");
  const buttonLabel = document.getElementById("button-label");
  const formMessage = document.getElementById("form-message");
  const modal = document.getElementById("confirmation-modal");
  const fields = {
    fullName: document.getElementById("full-name"),
    email: document.getElementById("email"),
    phone: document.getElementById("phone"),
    note: document.getElementById("note")
  };
  const requiredFields = ["fullName", "email", "phone"];
  const pendingForms = new Map();
  const channelName = "event-registration-response";
  let isSubmitting = false;
  let isFull = false;
  let pendingRequest = readPendingRequest();

  document.getElementById("event-name").textContent = config.event.name;
  document.getElementById("event-description").textContent = config.event.description;
  document.getElementById("event-date").textContent = config.event.date;
  document.getElementById("event-location").textContent = config.event.location;
  document.getElementById("confirmed-event").textContent = config.event.name;
  document.getElementById("capacity-sheet-link").href = config.spreadsheetUrl;

  Object.keys(fields).forEach(function (key) {
    fields[key].addEventListener("input", function () {
      clearFormMessage();
      fields[key].dataset.touched = "true";
      validateField(key);
    });
    fields[key].addEventListener("blur", function () {
      fields[key].dataset.touched = "true";
      validateField(key);
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (isSubmitting || isFull) return;

    const payload = readForm();
    const isValid = requiredFields.reduce(function (valid, key) {
      return validateField(key) && valid;
    }, true);
    if (!isValid) {
      showFormMessage("Vui lòng kiểm tra lại các thông tin bắt buộc.", false);
      const firstInvalid = requiredFields.find(function (key) {
        return fields[key].getAttribute("aria-invalid") === "true";
      });
      if (firstInvalid) fields[firstInvalid].focus();
      return;
    }

    if (!config.apiUrl || !isValidApiUrl(config.apiUrl)) {
      showFormMessage("Bảng tính đã được cấu hình, nhưng cần triển khai Apps Script Web App và nhập URL /exec vào config.js để gửi đăng ký.", false);
      return;
    }

    const requestId = getRequestId(payload);
    isSubmitting = true;
    setLoading(true);
    clearFormMessage();

    try {
      const result = await postToAppsScript({
        action: "register",
        requestId: requestId,
        registration: payload
      });

      if (!result.ok) {
        if (result.code === "FULL") setCapacityFull();
        if (result.code === "VALIDATION_ERROR" && result.field) {
          const fieldKey = result.field === "name" ? "fullName" : result.field;
          if (fields[fieldKey]) {
            fields[fieldKey].dataset.touched = "true";
            setFieldError(fieldKey, result.message || "Thông tin chưa hợp lệ.");
          }
        }
        showFormMessage(result.message || "Không thể hoàn tất đăng ký. Vui lòng thử lại.", false);
        return;
      }

      if (!result.registrationId || !result.registeredAt) {
        throw new Error("Máy chủ trả về phản hồi đăng ký chưa đầy đủ.");
      }

      await updateAvailability().catch(function () {
        return null;
      });
      showConfirmation(payload, result);
      form.reset();
      Object.keys(fields).forEach(function (key) {
        fields[key].dataset.touched = "false";
        setFieldError(key, "");
      });
      clearPendingRequest();
    } catch (error) {
      showFormMessage(
        error && error.message
          ? error.message
          : "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.",
        false
      );
    } finally {
      isSubmitting = false;
      setLoading(false);
    }
  });

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-done").addEventListener("click", closeModal);
  modal.addEventListener("click", function (event) {
    if (event.target === modal) closeModal();
  });

  window.addEventListener("message", function (event) {
    if (!isTrustedAppsScriptOrigin(event.origin) || !event.data ||
        event.data.channel !== channelName || typeof event.data.requestId !== "string") return;
    const pending = pendingForms.get(event.data.requestId);
    if (!pending || event.source !== pending.iframe.contentWindow) return;
    clearTimeout(pending.timeout);
    pendingForms.delete(event.data.requestId);
    pending.form.remove();
    pending.iframe.remove();
    pending.resolve(event.data.result);
  });

  updateAvailability();
  window.setInterval(updateAvailability, config.refreshIntervalMs);

  function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function readForm() {
    return {
      fullName: normalizeWhitespace(fields.fullName.value),
      email: normalizeWhitespace(fields.email.value).toLowerCase(),
      phone: normalizeWhitespace(fields.phone.value),
      note: normalizeWhitespace(fields.note.value)
    };
  }

  function validateField(key) {
    const value = normalizeWhitespace(fields[key].value);
    let error = "";
    if (requiredFields.indexOf(key) !== -1 && !value) {
      error = "Vui lòng nhập thông tin này.";
    } else if (key === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      error = "Vui lòng nhập địa chỉ email hợp lệ.";
    } else if (key === "phone" && value && !/^0\d{9}$/.test(value)) {
      error = "Số điện thoại cần có 10 chữ số và bắt đầu bằng số 0.";
    }
    setFieldError(key, error);
    return !error;
  }

  function setFieldError(key, message) {
    const input = fields[key];
    input.setAttribute("aria-invalid", message ? "true" : "false");
    document.getElementById(key.replace(/[A-Z]/g, function (letter) {
      return "-" + letter.toLowerCase();
    }) + "-error").textContent = message;
  }

  function showFormMessage(message, success) {
    formMessage.textContent = message;
    formMessage.classList.toggle("message-success", Boolean(success));
  }

  function clearFormMessage() {
    formMessage.textContent = "";
    formMessage.classList.remove("message-success");
  }

  function setLoading(loading) {
    submitButton.disabled = loading || isFull;
    submitButton.classList.toggle("is-loading", loading);
    submitButton.classList.toggle("is-full", isFull);
    buttonLabel.textContent = loading ? "Đang gửi…" : (isFull ? "Hết chỗ" : "Đăng ký tham gia");
  }

  async function updateAvailability() {
    if (!config.apiUrl || !isValidApiUrl(config.apiUrl)) {
      showUnknownAvailability("Chờ Web App");
      return null;
    }
    try {
      const result = await postToAppsScript({ action: "availability" });
      if (!result.ok || !Number.isInteger(result.remaining) || !Number.isInteger(result.capacity)) {
        throw new Error(result.message || "Máy chủ trả về số chỗ không hợp lệ.");
      }
      document.getElementById("seats-remaining").textContent = result.remaining + " / " + result.capacity + " chỗ";
      document.getElementById("capacity-caption").textContent = "chỗ còn lại";
      setCapacityMessage(result.remaining === 0 ? "Hết chỗ" : "Còn chỗ", "", result.remaining === 0);
      if (result.remaining === 0) setCapacityFull();
      else if (isFull) {
        isFull = false;
        setLoading(false);
      }
      return result;
    } catch (error) {
      showUnknownAvailability("Không kết nối");
      return null;
    }
  }

  function showUnknownAvailability(statusText) {
    document.getElementById("seats-remaining").textContent = "—";
    document.getElementById("capacity-caption").textContent = "chỗ còn lại";
    const status = document.getElementById("capacity-status");
    status.textContent = statusText;
    status.classList.add("status-error");
    status.classList.remove("status-full");
  }

  function setCapacityMessage(label, description, error) {
    const status = document.getElementById("capacity-status");
    status.textContent = label;
    status.classList.toggle("status-error", Boolean(error));
    status.classList.toggle("status-full", label === "Hết chỗ");
    if (description) document.getElementById("seats-remaining").textContent = description;
  }

  function setCapacityFull() {
    isFull = true;
    document.getElementById("seats-remaining").textContent = "Đã đủ 50 người";
    document.getElementById("capacity-caption").textContent = "Tạm ngừng nhận đăng ký";
    setCapacityMessage("Hết chỗ", "", false);
    setLoading(false);
  }

  function isValidApiUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "script.google.com" &&
        url.pathname.indexOf("/macros/s/") === 0 && /\/exec\/?$/.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  function postToAppsScript(payload) {
    return new Promise(function (resolve, reject) {
      const requestId = createRequestId();
      const iframe = document.createElement("iframe");
      const postForm = document.createElement("form");
      iframe.name = "event-api-" + requestId;
      iframe.title = "Kết nối bảo mật đến dịch vụ đăng ký";
      iframe.hidden = true;
      postForm.method = "POST";
      postForm.action = config.apiUrl;
      postForm.target = iframe.name;
      postForm.enctype = "application/x-www-form-urlencoded";
      postForm.hidden = true;
      const payloadField = document.createElement("input");
      payloadField.type = "hidden";
      payloadField.name = "payload";
      payloadField.value = JSON.stringify(payload);
      postForm.appendChild(payloadField);
      const transportField = document.createElement("input");
      transportField.type = "hidden";
      transportField.name = "transportId";
      transportField.value = requestId;
      postForm.appendChild(transportField);

      const timeout = window.setTimeout(function () {
        pendingForms.delete(requestId);
        postForm.remove();
        iframe.remove();
        reject(new Error("Chưa nhận được phản hồi từ Google Sheets. Hãy kiểm tra URL /exec, quyền truy cập Web App và phiên bản đã triển khai. Đăng ký chưa được xác nhận; dữ liệu vẫn được giữ."));
      }, 25000);

      pendingForms.set(requestId, { resolve: resolve, reject: reject, form: postForm, iframe: iframe, timeout: timeout });
      document.body.appendChild(iframe);
      document.body.appendChild(postForm);
      postForm.submit();
    });
  }

  function isTrustedAppsScriptOrigin(origin) {
    try {
      const url = new URL(origin);
      return url.protocol === "https:" &&
        (url.hostname === "script.google.com" || url.hostname.endsWith(".googleusercontent.com"));
    } catch (error) {
      return false;
    }
  }

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function getRequestId(payload) {
    const serialized = JSON.stringify(payload);
    if (pendingRequest && pendingRequest.payload === serialized) return pendingRequest.requestId;
    pendingRequest = { payload: serialized, requestId: createRequestId() };
    try {
      window.sessionStorage.setItem("event-registration-pending", JSON.stringify(pendingRequest));
    } catch (error) {
      // The in-memory request ID still protects retries during this page session.
    }
    return pendingRequest.requestId;
  }

  function readPendingRequest() {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem("event-registration-pending") || "null");
      if (saved && typeof saved.payload === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.requestId)) {
        return saved;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function clearPendingRequest() {
    pendingRequest = null;
    try {
      window.sessionStorage.removeItem("event-registration-pending");
    } catch (error) {
      // The in-memory value is cleared even when browser storage is unavailable.
    }
  }

  function showConfirmation(payload, result) {
    document.getElementById("confirmed-name").textContent = payload.fullName;
    document.getElementById("registration-code").textContent = result.registrationId;
    const emailNotice = document.getElementById("email-notice");
    if (result.emailStatus === "sent" || result.emailSent === true) {
      emailNotice.textContent = "Email xác nhận đã được gửi đến " + payload.email + ".";
    } else if (result.emailStatus === "pending") {
      emailNotice.textContent = "Đăng ký đã được lưu. Email xác nhận đang được xử lý; vui lòng không đăng ký lại.";
    } else if (result.emailStatus === "unknown") {
      emailNotice.textContent = "Đăng ký đã được lưu. Không thể xác định trạng thái email; vui lòng kiểm tra hộp thư trước khi liên hệ ban tổ chức.";
    } else {
      emailNotice.textContent = "Đăng ký đã được lưu. Email xác nhận chưa gửi được; vui lòng kiểm tra hộp thư sau hoặc liên hệ ban tổ chức.";
    }
    const qr = document.getElementById("qr-image");
    const placeholder = document.getElementById("qr-placeholder");
    qr.hidden = true;
    placeholder.hidden = false;
    placeholder.textContent = "Đang tạo mã QR…";
    qr.onload = function () {
      qr.hidden = false;
      placeholder.hidden = true;
    };
    qr.onerror = function () {
      qr.hidden = true;
      placeholder.hidden = false;
      placeholder.textContent = "Không tải được mã QR. Hãy lưu lại mã đăng ký ở trên để check-in.";
    };
    const qrText = "Ho ten: " + payload.fullName + "\nMa dang ky: " + result.registrationId;
    qr.src = config.quickChartBaseUrl + "?text=" + encodeURIComponent(qrText) + "&size=240&margin=2&ecLevel=M";
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function closeModal() {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }
})();
