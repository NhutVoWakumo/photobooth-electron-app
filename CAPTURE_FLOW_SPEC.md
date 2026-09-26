# Capture & Template Flow — Product Spec

## 1. Quyết định cốt lõi

Trình tự khách dùng booth:

```text
Chọn frame → xem preview → bắt đầu session
→ chụp và review theo capture mode đã chọn
→ chọn ảnh + sắp vị trí
→ render frame → xác nhận → lưu / in
```

Ký hiệu frame dùng **hàng × cột**. Vì vậy `4×1` là bốn ảnh xếp dọc,
`3×2` là sáu ảnh theo ba hàng, hai cột. Đây là quy ước cố định ở UI,
manifest và code.

## 2. Khổ in chuẩn cho bản đầu

| Frame | Số slot N | Khổ thành phẩm | Canvas render v1 | Ghi chú |
| --- | ---: | --- | --- | --- |
| `4×1` classic strip | 4 | 2 × 6 in | 600 × 1800 px @ 300 ppi | Strip chuẩn; về sau printer service có thể xếp 2 strip lên một tờ 4 × 6. |
| `3×2` grid | 6 | 4 × 6 in dọc | 1200 × 1800 px @ 300 ppi | Ba hàng, hai cột; dùng media 4 × 6 phổ biến. |
| `1×1` portrait | 1 | 4 × 6 in dọc | 1200 × 1800 px @ 300 ppi | Một ảnh lớn, có vùng cho branding/text. |

DNP DS620A là mốc tham khảo tốt cho booth: hãng công bố khổ 4 × 6 in rất
nhanh, độ phân giải máy 300 × 600 dpi và khổ chuẩn lớn nhất 6 × 8.
Media 4 × 6 thường có thể cắt hai strip 2 × 6. Tuy nhiên v1 xuất canvas ở
300 ppi để tương thích nhiều máy; printer adapter sẽ đảm nhiệm profile/driver
và cách xếp hai strip khi đã chọn đúng máy in.

Nguồn đã kiểm tra: [DNP DS620A specifications](https://www.dnpphoto.com/products/printers/ds620a)
và [media 4×6 / 2×6](https://www.bhphotovideo.com/c/product/1117444-REG/dnp_ds6204x6_4x6_print_pack_for.html).

## 3. Template picker

Đây là màn hình đầu tiên khi khách chạm **Begin session**.

Mỗi thẻ frame phải có:

- Preview khung có ảnh mẫu, không phải chỉ icon.
- Nhãn dễ hiểu: `Classic strip · 4 photos`, `Grid · 6 photos`, `Portrait · 1 photo`.
- Khổ in và số ảnh bắt buộc.
- Badge “Recommended” cho template được cấu hình làm mặc định.
- Nút `Choose this frame`; không đi thẳng vào camera khi chưa chọn.

Sau khi chọn, app mở màn hình **Frame preview**:

```text
[ preview frame đúng tỷ lệ in ]   4×1 Classic strip
                                  4 selected slots
                                  You can take 4–6 photos
                                  [ Start session ]
                                  [ Back ]
```

Preview dùng đúng template renderer sẽ dùng sau này: background, overlay,
safe-area và crop masks đều giống output. Không dùng mock preview khác bản in.

## 4. Capture budget

Mỗi template định nghĩa:

```ts
requiredSlots: N
extraCaptureAllowance: 2       // operator setting, có thể đổi
minimumCaptures: N
maximumCaptures: N + extraCaptureAllowance
countdownSeconds: 10
postCaptureReviewMs: 2000
```

Ví dụ frame `4×1` với setting mặc định:

```text
Cần điền:       4 slot
Được chụp:      4 đến 6 ảnh
Sau ảnh thứ 4:  có thể vào chọn/sắp ảnh ngay, hoặc chụp thêm tối đa 2 ảnh
Sau ảnh thứ 6:  phải hoàn tất chọn/sắp ảnh, không chụp thêm
```

Một lần bấm shutter, kể cả ảnh bị bỏ hoặc được chụp lại, vẫn tính vào
`maximumCaptures`. Điều này giữ session ngắn và tránh khách kẹt vô hạn.
Khi đã hết lượt, app chỉ cho chọn từ candidate pool hiện có.

## 5. Hai capture mode

### A. Guided review — mặc định

Mục tiêu: khách thấy frame ở cạnh preview camera và kiểm soát từng ảnh.

```text
Countdown → chụp → freeze preview tối thiểu 2 giây
→ Use photo / Retake / chọn một slot đã có để thay
→ tiếp tục đến khi đủ N slot, hoặc dùng thêm ảnh dự phòng
→ selection board → export
```

Giao diện gồm:

- Cột trái: live camera và countdown.
- Cột phải: preview frame thật với slot đang chọn.
- Khi chụp xong: freeze ảnh vừa chụp, hiện `Use this` và `Retake`.
- `Use this`: ảnh vào candidate pool và điền slot đang active.
- `Retake`: giữ nguyên slot, cho chụp lại; vẫn tiêu hao một lượt capture.
- Khách chạm slot bất kỳ trong preview để xem ảnh đang dùng và chọn `Replace`.
  Lần chụp tiếp theo thay slot đó.
- Sau khi đủ N slot, hiện `Choose & arrange`. Nếu còn quota, hiện thêm
  `Take another option (x left)`.

Review sau chụp là **minimum review duration**: app giữ frame ít nhất
`postCaptureReviewMs` để khách thấy ảnh, sau đó nút quyết định mở khóa.
Không tự bỏ qua ảnh thay khách.

### B. Batch review — setting tùy chọn

Mục tiêu: chụp liền mạch, chỉ curate ở cuối.

```text
Countdown → chụp N ảnh liên tiếp
→ sau ảnh N: [Choose now] hoặc [Capture another, x left]
→ tối đa N + allowance → selection board
```

Trong mode này không có Use/Retake giữa session. Nếu một ảnh fail, khách vẫn
phải chụp xong và loại nó ở selection board. Đây là mode “nhanh” cho event
đông người; không phải default.

## 6. Selection board

Dùng chung cho cả hai mode, luôn chạy trước render/export.

- Candidate pool hiển thị mọi ảnh đã chụp, số lượng từ N đến N + allowance.
- Frame canvas hiển thị đúng số slot N.
- Khách chọn đúng N ảnh từ pool và kéo-thả hoặc bấm mũi tên để đổi vị trí.
- Một ảnh không được điền hai slot, trừ khi template sau này khai báo cho phép.
- Slot active có viền và tên vị trí rõ ràng cho touchscreen/screen reader.
- Nút `Continue` chỉ bật khi tất cả slot đã được điền.
- Nút `Back to capture` chỉ bật khi còn capture quota.
- Preview crop được cập nhật ngay trên canvas template; đây là preview cuối
  trước khi export, không phải một grid ảnh rời.

## 7. Render và output

Template có manifest riêng. Renderer nhận `slotAssignments` thay vì chỉ
nhận mảng ảnh theo thứ tự:

```ts
type TemplateManifest = {
  id: 'classic-4x1' | 'grid-3x2' | 'portrait-1x1'
  output: { width: number; height: number; ppi: 300 }
  slots: Array<{ id: string; x: number; y: number; width: number; height: number }>
  assets: { background: string; overlay?: string; thumbnail: string }
}

type SessionSelection = {
  templateId: string
  captures: CapturedPhoto[]
  slotAssignments: Record<string, string> // slotId -> captureId
}
```

Render sequence:

```text
background → ảnh đã crop vào slot → editable text/logo → overlay → JPEG
```

Output được lưu local cùng originals và session metadata. Printer phase chỉ
nhận JPEG output này; không được tự render lại bằng layout khác.

## 8. Operator settings

Settings dành cho người vận hành, không hiện cho khách:

| Setting | Default | Ý nghĩa |
| --- | ---: | --- |
| Default capture mode | Guided review | Mode khách gặp khi bắt đầu session. |
| Capture mode | Guided review / Batch review | Guided duyệt từng ảnh; Batch chụp liên tục rồi chọn ở cuối. |
| Extra capture allowance | 2 | Max captures = slot count + số này. |
| Retake policy | Limited | Limited ẩn Retake khi quota còn lại phải dành cho slot trống; Unlimited luôn cho Retake. |
| Before countdown | 1 giây | Khoảng dừng sau khi vào live preview, trước mỗi countdown; có thể chọn chụp ngay. |
| Countdown | 10 giây | Trước mỗi shutter. |
| Minimum post-capture review | 2 giây | Guided mode chỉ mở nút quyết định sau thời gian này. |
| Original photo JPEG quality | 92% | Chất lượng của mỗi ảnh gốc lưu trong session. |
| Final print JPEG quality | 94% | Chất lượng file layout cuối cùng để lưu/in. |
| Enabled templates | cả 3 | Frame nào xuất hiện ở picker. |
| Default template | 4×1 | Thẻ được đề xuất, không auto-select. |
| Camera | thiết bị đã chọn | Giữ lựa chọn camera hiện tại. |
| Event name / branding set | Home test | Dữ liệu render text/logo theo event. |

## 9. Kế hoạch triển khai

### Phase 2A — Data model + template picker

- Thay frame hard-code bằng `TemplateManifest`.
- Thêm ba manifest và asset preview: `4×1`, `3×2`, `1×1`.
- Bắt buộc chọn frame trước session.
- Đổi output renderer hiện tại để đọc slot từ manifest.

**Xong khi:** chọn frame là điều kiện bắt đầu session; preview và output cùng
một layout engine.

**Trạng thái:** Đã triển khai. Ba manifest `classic-4x1`, `grid-3x2` và
`portrait-1x1` đã có picker, preview theo đúng tỉ lệ in và canvas renderer
dùng chung. Capture quota/candidate selection bắt đầu ở Phase 2B/C.

### Phase 2B — Capture engine theo quota

- Tách session state: `captures`, `activeSlotId`, `captureCount`,
  `maxCaptures`, `mode`.
- Sửa auto sequence hiện tại thành Guided review mặc định.
- Thêm Batch review làm mode thứ hai.
- Thêm timer review tối thiểu và trạng thái camera fail.

**Xong khi:** frame 4×1 chụp từ 4–6 ảnh đúng config, không thể vượt quota.

**Trạng thái:** Xong. Guided review là mặc định: frame xuất hiện cạnh preview
camera, ảnh vừa chụp freeze để Use/Retake, slot active được đánh dấu, retake
tiêu hao quota, và app khóa Retake khi cần giữ đủ lượt cho các slot còn trống.
Batch review cũng đã có; nó chụp liên tục đến khi đủ N ảnh rồi chuyển tới
selection board.

### Phase 2C — Selection board

- Candidate pool, slot assignments, thay ảnh slot, reorder touch-friendly.
- Validate đủ N slot trước Continue.
- Render preview thật từ assignments.

**Xong khi:** chụp 6 ảnh cho frame 4×1, chọn và sắp bất kỳ 4 ảnh trước export.

**Trạng thái:** Xong. Selection board hiển thị candidate pool, cho chọn slot
rồi gán/move ảnh bằng touch, chuột hoặc bàn phím; Continue chỉ bật khi đủ slot.
Khách có thể chụp thêm từ board khi còn quota.

### Phase 2D — Storage/export integration

- Lưu manifest id, capture ids và slot assignments trong `session.json`.
- Xuất JPEG theo đúng khổ frame chọn.
- Mở sẵn interface cho printer layout: strip 2-up trên 4×6.

**Xong khi:** mỗi session có originals, output, metadata đủ để reprint sau này.

**Trạng thái:** Xong phần export/storage. Mỗi session lưu `originals/`,
`outputs/strip.jpg`, `outputs/print-sheet-4x6.jpg` và `session.json` có
template, capture ids, slot assignments, khổ in và số bản trên mỗi tờ. Với
frame 4×1, print sheet tự đặt hai strip giống nhau lên một canvas 4×6 @ 300
ppi; hai frame 4×6 giữ layout một-up. Phase 3 chỉ cần gửi print sheet này qua
driver máy in, không render lại.

## 10. Thứ tự code nên làm ngay

Bắt đầu Phase 2A trước. Không nối selection board vào renderer cũ vì nó đang giả
định “toàn bộ ảnh chụp đều đi vào frame”. Khi manifest và session data model đã
đúng, Guided/Batched mode chỉ là hai cách tạo candidate pool và slot assignments.
