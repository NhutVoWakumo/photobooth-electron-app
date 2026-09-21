# Photobooth Desktop — Product Spec

> Capture/template flow, print sizes and the next implementation phases are
> specified in [CAPTURE_FLOW_SPEC.md](./CAPTURE_FLOW_SPEC.md). That document
> supersedes the original single-strip assumption below.

## 1. Mục tiêu

Xây dựng một ứng dụng photobooth desktop, chạy offline trên macOS và Windows.
Ứng dụng điều khiển trải nghiệm tự phục vụ: chọn thiết bị, preview, chụp, ghép
khung, khách xác nhận, in và lưu ảnh.

**Mục tiêu MVP:** dùng webcam bất kỳ (kể cả camera laptop) và máy in văn phòng
để kiểm chứng toàn bộ luồng. Không cần Internet, DSLR hay máy in DNP để bắt đầu.

**Mục tiêu dài hạn:** đóng app vào photobooth box trên mini PC Windows, kết nối
camera Canon/Fujifilm, máy in ảnh sự kiện và có QR/cloud sync tùy chọn.

## 2. Quyết định kỹ thuật

| Thành phần | Chọn cho bản đầu | Lý do |
| --- | --- | --- |
| Desktop shell | Electron | React/TypeScript, dễ chạy macOS/Windows và tích hợp thiết bị. |
| UI | React + TypeScript | Phần kiosk, cấu hình, template editor. |
| Chụp MVP | Webcam qua browser media API | Không phụ thuộc model camera; camera laptop dùng ngay. |
| Ghép ảnh | Canvas renderer cục bộ | Render ổn định, offline, xuất file in được. |
| Lưu trữ | Ổ đĩa máy chạy booth | Nhanh, offline, đơn giản để backup. |
| In | Printer service qua Electron/OS | App chọn máy in và gửi file; driver do macOS/Windows cung cấp. |

Một codebase chạy cả macOS và Windows. Hệ điều hành cài driver rồi đưa camera/
máy in cho app; app chỉ liệt kê, chọn và sử dụng thiết bị đó.

## 3. Phạm vi MVP

### Có

1. Màn hình **Settings**: chọn webcam, chọn máy in, chọn thư mục lưu ảnh.
2. Màn hình kiosk: live preview, chọn một template, nút bắt đầu.
3. Countdown 3 giây và chụp 3 tấm ảnh.
4. Ghép 3 ảnh vào một template strip có sẵn.
5. Preview kết quả; khách chọn **In** hoặc **Chụp lại**.
6. In qua máy in mặc định hoặc máy in đã chọn.
7. Lưu ảnh gốc và ảnh thành phẩm ở máy local.
8. Báo rõ camera/máy in mất kết nối hoặc lệnh in thất bại.

### Chưa làm ở MVP

- Điều khiển Canon/Fujifilm để lấy ảnh JPEG/RAW gốc qua USB (tethered capture).
- Máy in DNP/HiTi và trạng thái chi tiết như hết giấy/kẹt giấy.
- QR download, cloud upload, gallery online.
- Editor template cho khách kéo-thả tự thiết kế.
- Thanh toán, tài khoản, quản lý nhiều booth từ xa.

## 4. Luồng người dùng

```text
Nhân viên: Settings → chọn camera + máy in + template
Khách: Start → preview → countdown → chụp 3 tấm
      → render khung → xem ảnh
      → Print → lưu file + gửi in → Done → quay về màn hình chờ
```

Nếu khách chọn **Retake**, ảnh của lượt thử bị đánh dấu là bỏ qua rồi quay lại
preview. Ảnh thành phẩm chỉ tạo khi khách xác nhận in/lưu.

## 5. Các màn hình

| Màn hình | Dành cho | Chức năng |
| --- | --- | --- |
| Attract / Idle | Khách | Nhấn để bắt đầu; có thể chạy slideshow. |
| Capture | Khách | Preview camera, chọn template (nếu cho phép), bắt đầu. |
| Countdown | Khách | Đếm ngược toàn màn hình; chụp tự động. |
| Review | Khách | Xem thành phẩm, In, Chụp lại. |
| Printing / Done | Khách | Báo đang in/xong, tự quay lại Idle. |
| Settings | Nhân viên | Thiết bị, folder, số ảnh, countdown, template, test print. |

## 6. Thiết bị và trách nhiệm

### Camera

- MVP đọc danh sách webcam từ hệ điều hành và hiển thị tên thiết bị.
- Camera đã chọn cung cấp live preview và frame ảnh để chụp.
- Khi camera bị rút dây, UI hiện `Disconnected` và không cho bắt đầu lượt chụp.
- Camera laptop luôn là lựa chọn fallback để phát triển/test.

Về sau sẽ có thêm `TetheredCameraAdapter` cho Canon/Fujifilm. UI không đổi;
adapter chỉ thay cách chụp từ webcam frame thành file ảnh gốc của máy ảnh.

### Máy in

- App hỏi hệ điều hành danh sách máy in đã cài driver.
- Settings cho chọn một máy in và nút test print.
- MVP chỉ cần biết: `ready`, `offline/not found`, `printing`, `failed`.
- Máy in văn phòng in thành phẩm vào trang A4 để thử; người dùng cắt strip tay.

Máy in DNP/HiTi về sau là implementation tốt hơn của cùng printer service.
Trạng thái như giấy/mực còn lại phụ thuộc driver/SDK của mẫu máy in.

## 7. Template system (thiết kế để mở rộng)

Không code cứng template. Mỗi template là một thư mục độc lập:

```text
templates/wedding-strip/
  manifest.json
  background.png
  overlay.png
  thumbnail.png
```

`manifest.json` định nghĩa kích thước output, vùng ảnh và vùng text. Ví dụ:

```json
{
  "id": "wedding-strip-v1",
  "name": "Wedding strip",
  "size": { "width": 1200, "height": 3600, "dpi": 300 },
  "photoSlots": [
    { "x": 100, "y": 200, "width": 1000, "height": 900 },
    { "x": 100, "y": 1150, "width": 1000, "height": 900 },
    { "x": 100, "y": 2100, "width": 1000, "height": 900 }
  ],
  "textFields": []
}
```

Renderer làm theo thứ tự: `background` → crop ảnh vào slot → text → `overlay`.
Do đó có thể nhận template mới mà không sửa code flow.

### Khi khách gửi thiết kế

Ban đầu, khách/designer gửi:

- PSD hoặc AI gốc (nếu có);
- PNG overlay nền trong suốt, đúng kích thước in;
- background/logo/font riêng nếu có;
- mockup chứa ảnh mẫu để xác nhận crop và bố cục.

Nhân viên tạo `manifest.json` cho template trong internal template editor (phase
sau). Không nhận mỗi PNG nếu chưa biết các vùng đặt ảnh.

## 8. Lưu file

App tạo thư mục theo event và ngày:

```text
Photobooth Photos/
  2026-09-20-home-test/
    originals/
    outputs/
    sessions.jsonl
```

- `originals`: ảnh của từng lượt chụp.
- `outputs`: ảnh đã ghép template, là file gửi in.
- `sessions.jsonl`: log nhỏ, không lưu bí mật: thời gian, template, thiết bị,
  kết quả in và đường dẫn file.

Không xóa ảnh tự động ở MVP. Backup/export và cloud sync là phase sau.

## 9. Kiến trúc ứng dụng

```text
React renderer (kiosk UI, state, preview, canvas)
        ↕ IPC an toàn
Electron main process
        ├── Device service: webcam + printer discovery/status
        ├── Print service: gửi output sang OS printer
        ├── Storage service: tạo folder, lưu file, session log
        └── Template service: đọc/validate manifest và assets
```

Nguyên tắc: React không truy cập thẳng filesystem hay lệnh hệ điều hành. Mọi
quyền native đi qua API IPC nhỏ, có kiểu TypeScript rõ ràng.

## 10. Kế hoạch thực hiện

### Phase 0 — Scaffold và thiết bị giả (1 buổi)

- Khởi tạo Electron + React + TypeScript.
- Kiosk routes: Idle, Capture, Review, Settings.
- Device service có mock webcam/printer để hoàn thiện UI trước.

**Xong khi:** app chạy trên Mac, chuyển màn hình được, Settings lưu config local.

### Phase 1 — Luồng chụp webcam thật (1–2 buổi)

- Liệt kê webcam thật, chọn camera, live preview.
- Countdown và capture 3 frame ảnh.
- Xử lý camera bị mất kết nối.

**Xong khi:** local webcam chụp được một session hoàn chỉnh.

**Trạng thái:** Đã triển khai. Cần manual QA một lần trên Electron: cấp quyền
camera ở macOS, chụp đủ ba frame và xác nhận review. Không thể tự động xác nhận
prompt quyền camera thay cho người dùng.

### Phase 2 — Template renderer và local storage (1–2 buổi)

- Làm một `2×6 inch` strip template.
- Render/crop ảnh chính xác, export JPEG/PNG.
- Lưu originals, output, session log theo event/date.

**Xong khi:** xem được file thành phẩm đẹp trong folder local.

**Trạng thái:** Đã triển khai template strip 2×6 đầu tiên. Renderer crop giữa ảnh
vào các slot dọc, xuất JPEG, rồi lưu `originals/`, `outputs/strip.jpg` và
`session.json` dưới `~/Pictures/Stillroom Photos/<ngày>-<event>/<session>/`.
Chưa có template manifest/overlay của khách; đó là cải tiến template system kế tiếp.

### Phase 3 — In với máy in văn phòng (1 buổi)

- Liệt kê/chọn printer OS.
- Test print, trạng thái in cơ bản, retry rõ ràng.
- Đưa strip vào trang A4 để test bằng máy in hiện có.

**Xong khi:** khách bấm In và nhận trang in từ máy in văn phòng.

### Phase 4 — Chạy thử như booth (1–2 buổi)

- Fullscreen/kiosk mode, tự reset về Idle.
- Không cho khách vào Settings.
- Chạy liên tục 20–30 lượt, ghi mọi lỗi/corner case.

**Xong khi:** bạn bè có thể tự dùng không cần hướng dẫn.

### Phase 5 — Nâng cấp phần cứng (sau khi MVP ổn)

- Thử R50/X-T3 ở webcam mode bằng USB-C data.
- Quyết định tethered capture cho ảnh gốc.
- Test mini PC Windows + đúng mẫu máy in ảnh muốn mua.
- Thêm QR/cloud sync và template editor nội bộ theo nhu cầu thực tế.

## 11. Tiêu chí không được thỏa hiệp

- Chụp và in vẫn hoạt động khi không có Internet.
- Không làm mất ảnh thành phẩm nếu máy in lỗi.
- Mọi lỗi thiết bị phải nói rõ cho nhân viên biết cần cắm/cài gì.
- Không để UI khách thấy đường dẫn file, setting OS hay thao tác kỹ thuật.
- Phải test trước trên mini PC Windows sẽ đem đi kinh doanh, không chỉ trên Mac.

## 12. Việc code đầu tiên

Khởi tạo app Electron + React + TypeScript và làm Phase 0, sau đó dùng local
webcam hoàn thành Phase 1. Chưa mua hay tích hợp thêm thiết bị nào cho tới khi
luồng chụp–review chạy mượt.
