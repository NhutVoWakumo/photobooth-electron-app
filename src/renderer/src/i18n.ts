export type Language = 'vi' | 'en'

export type TemplateCopy = {
  name: string
  description: string
  printLabel: string
}

const messages = {
  vi: {
    language: 'Ngôn ngữ', vietnamese: 'Tiếng Việt', english: 'English', settings: 'Cài đặt',
    operatorArea: 'Khu vực vận hành', boothSettings: 'Cài đặt booth', saveSettings: 'Lưu cài đặt', cancel: 'Hủy', closeSettings: 'Đóng cài đặt',
    eventName: 'Tên sự kiện', welcomeHeading: 'Tiêu đề chào', welcomeHeadingHelp: 'Xuống dòng để tạo dòng chữ xanh thứ hai.', camera: 'Máy ảnh', printer: 'Máy in', refresh: 'Làm mới',
    chooseFrame: 'Chọn khung', chooseAnother: 'Chọn khung khác', startSession: 'Bắt đầu chụp', back: 'Quay lại',
    frameSelected: 'Đã chọn khung', finalPrint: 'Bản in', layout: 'Bố cục', canvas: 'Canvas',
    framePickerTitle: 'Chọn khung ảnh.', framePickerHelp: 'Mỗi khung hiển thị đúng tỷ lệ bản in cuối.',
    sessionComplete: 'Hoàn tất phiên chụp', keepSet: 'Giữ bộ ảnh này?', retakeAll: 'Chụp lại toàn bộ', finish: 'Kết thúc',
    livePreview: 'Xem trước trực tiếp', cameraOffline: 'Máy ảnh ngoại tuyến', openingCamera: 'Đang mở máy ảnh…',
    homeKicker: 'Photobooth tại nhà', homeTitle: 'Lưu lại một khoảnh khắc.', homeHelp: 'Mỗi phiên bắt đầu bằng việc chọn khung. Dành cho {eventName}.',
    phase: 'Giai đoạn 2D · Lưu & xuất ảnh', offline: 'Photobooth desktop chạy offline',
    defaultLanguageHelp: 'Tiếng Việt là mặc định. Đổi ngôn ngữ sẽ áp dụng khi lưu.',
    noCamera: 'Chưa phát hiện máy ảnh', cameraPermissionBlocked: 'Quyền máy ảnh đang bị chặn. Hãy bật quyền trong Cài đặt hệ thống macOS rồi mở lại ứng dụng.', cameraPermissionHelp: 'Lần đầu chụp, ứng dụng sẽ hỏi quyền dùng máy ảnh. Tên thiết bị hiện sau khi bạn cấp quyền.',
    noPrinter: 'Chưa chọn máy in', officePrinter: 'Máy in văn phòng (mô phỏng)', dnpPrinter: 'DNP DS620A (mô phỏng)', printerPhaseHelp: 'Kết nối máy in thật sẽ được bổ sung ở Phase 3.',
    captureMode: 'Chế độ chụp', guidedMode: 'Duyệt từng ảnh (mặc định)', batchMode: 'Chụp liên tục rồi chọn', captureModeHelp: 'Duyệt từng ảnh cho khách duyệt ngay. Chụp liên tục sẽ chụp đủ lượt rồi mới chọn ở cuối.',
    retakePolicy: 'Chính sách chụp lại', limitedRetakes: 'Giới hạn theo số ảnh thêm', unlimitedRetakes: 'Chụp lại không giới hạn', retakePolicyHelp: 'Mặc định có giới hạn: nút Chụp lại ẩn khi cần giữ lượt cho các ô còn trống.',
    extraPhotos: 'Số ảnh chụp thêm', noExtras: 'Không thêm', oneExtra: '1 ảnh thêm', twoExtras: '2 ảnh thêm', threeExtras: '3 ảnh thêm', fourExtras: '4 ảnh thêm',
    beforeCountdown: 'Chờ trước khi đếm', startImmediately: 'Bắt đầu ngay', second: '1 giây', seconds2: '2 giây', seconds3: '3 giây',
    countdown: 'Đếm ngược', noCountdown: 'Không đếm ngược', seconds5: '5 giây', seconds10: '10 giây',
    minimumReview: 'Thời gian xem ảnh tối thiểu', noLock: 'Không khóa', reviewHelp: 'Ở chế độ duyệt, nút Dùng ảnh và Chụp lại sẽ khóa trong thời gian này để khách kịp xem ảnh.',
    originalQuality: 'Chất lượng ảnh gốc', finalQuality: 'Chất lượng JPEG bản in', recommended: 'khuyến nghị', qualityHelp: 'Chất lượng cao dùng nhiều dung lượng hơn.', finalQualityHelp: 'Áp dụng cho file đã ghép trước khi gửi tới máy in.',
    cameraAria: 'Máy ảnh',
    templateClassicName: 'Dải ảnh cổ điển', templateClassicDescription: 'Bốn chân dung xếp dọc.', templateClassicPrint: 'Dải 2 × 6 inch',
    templateGridName: 'Lưới sáu ảnh', templateGridDescription: 'Ba hàng, hai cột.', templateGridPrint: 'Bưu thiếp 4 × 6 inch',
    templatePortraitName: 'Chân dung toàn khung', templatePortraitDescription: 'Một ảnh với kích thước rộng rãi.', templatePortraitPrint: 'Bưu thiếp 4 × 6 inch',
    selectedFramePreview: 'Xem trước khung đã chọn', photoPlan: 'Bạn sẽ chụp {min}-{max} ảnh, sau đó chọn {required} ảnh cuối.',
    capturedPhotoOptions: 'Các lựa chọn ảnh đã chụp', capturedPhoto: 'Ảnh đã chụp {index}', capturedPhotoInSlot: ', hiện ở ô {slot}', slotLabel: 'Ô {slot}', available: 'Có thể chọn', photoCount: '{count} ảnh',
    emptyPhotoPool: 'Ảnh đã chụp sẽ xuất hiện ở đây.', finalArrangement: 'Bố cục khung cuối. Chọn một ô để chỉnh.',
    reviewSummary: 'Bạn đã ghép {required} ảnh thành bố cục {print}. Lưu để giữ cả ảnh gốc và JPEG cuối trên máy tính này.',
    cameraErrorUnsupported: 'Thiết bị này không hỗ trợ truy cập máy ảnh.', cameraErrorDenied: 'Quyền máy ảnh bị từ chối. Hãy cho phép truy cập máy ảnh trên macOS rồi bắt đầu lại phiên.', cameraErrorNotFound: 'Không tìm thấy máy ảnh. Hãy kết nối máy ảnh hoặc dùng webcam MacBook.', cameraErrorOpenFailed: 'Không thể mở máy ảnh đã chọn. Hãy thử thiết bị khác.',
    liveCameraPreview: 'Xem trước máy ảnh trực tiếp', attemptsUsed: 'Đã dùng {attempts} lượt chụp', unlimitedRetakeShort: 'chụp lại không giới hạn', maximumShort: 'tối đa {limit}',
    replaceFilledSlot: 'Thay ảnh trong ô {slot}', remainingShotsReserved: 'Các lượt còn lại được giữ cho ô trống.', tapFilledSlot: 'Chạm vào ô đã có ảnh để thay.', chooseFinalBatch: 'Bạn sẽ chọn khung cuối sau khi chụp liên tục.',
    threeLayouts: 'ba bố cục', guidedReview: 'duyệt từng ảnh', madeOffline: 'chạy offline',
    cameraUnsupported: 'Không hỗ trợ máy ảnh', cameraStatusReady: 'Sẵn sàng', welcomeScreen: 'Về màn hình bắt đầu',
    finalPhoto: 'Ảnh thành phẩm', printSheet: 'Bản in 4 × 6', twoUpPrintHelp: 'Bản in này có 2 dải ảnh giống nhau trên một tờ 4 × 6 để cắt ra.', singlePrintHelp: 'Bản in này khớp đúng khổ 4 × 6.',
    finalReadyToSave: 'Ảnh thành phẩm và bản in đã sẵn sàng để lưu.', savingSession: 'Đang lưu ảnh gốc, ảnh thành phẩm và bản in…', sessionSaved: 'Đã lưu phiên chụp trên máy này.', saveSession: 'Lưu phiên chụp', printLayout: 'Bố cục để in', copiesPerSheet: '{count} bản trên mỗi tờ',
    motionLevel: 'Độ mượt hiệu ứng', motionLow: 'Nhẹ · ưu tiên máy yếu', motionMedium: 'Vừa · cân bằng', motionHigh: 'Cao · mượt nhất', motionHelp: 'Chỉ ảnh hưởng chuyển cảnh giao diện; không làm chậm lúc chụp ảnh.'
  },
  en: {
    language: 'Language', vietnamese: 'Tiếng Việt', english: 'English', settings: 'Settings',
    operatorArea: 'Operator area', boothSettings: 'Booth settings', saveSettings: 'Save settings', cancel: 'Cancel', closeSettings: 'Close settings',
    eventName: 'Event name', welcomeHeading: 'Welcome headline', welcomeHeadingHelp: 'Use a new line to create the second green line.', camera: 'Camera', printer: 'Printer', refresh: 'Refresh',
    chooseFrame: 'Choose frame', chooseAnother: 'Choose another', startSession: 'Start session', back: 'Back',
    frameSelected: 'Frame selected', finalPrint: 'Final print', layout: 'Layout', canvas: 'Canvas',
    framePickerTitle: 'Choose your frame.', framePickerHelp: 'Every layout is rendered at its final print ratio.',
    sessionComplete: 'Session complete', keepSet: 'Keep this set?', retakeAll: 'Retake all', finish: 'Finish test',
    livePreview: 'Live preview', cameraOffline: 'Camera offline', openingCamera: 'Opening camera…',
    homeKicker: 'A quiet test booth', homeTitle: 'Keep a moment.', homeHelp: 'Every session starts by choosing a frame. Built for {eventName}.',
    phase: 'Phase 2D · Save & export', offline: 'Offline-first desktop photobooth',
    defaultLanguageHelp: 'Vietnamese is the default. The language changes when you save.',
    noCamera: 'No camera detected yet', cameraPermissionBlocked: 'Camera permission is blocked. Enable it in macOS System Settings, then reopen the app.', cameraPermissionHelp: 'The first session asks macOS for camera permission. Camera names appear after permission is granted.',
    noPrinter: 'No printer selected', officePrinter: 'Office printer (mock)', dnpPrinter: 'DNP DS620A (mock)', printerPhaseHelp: 'Real printer detection arrives in Phase 3.',
    captureMode: 'Capture mode', guidedMode: 'Guided review (default)', batchMode: 'Batch review', captureModeHelp: 'Guided lets the guest approve each photo. Batch captures continuously, then lets them choose at the end.',
    retakePolicy: 'Retake policy', limitedRetakes: 'Limited by extra photo options', unlimitedRetakes: 'Unlimited retakes', retakePolicyHelp: 'Limited is the default: Retake disappears when the remaining quota is needed for empty frame slots.',
    extraPhotos: 'Extra photo options', noExtras: 'No extras', oneExtra: '1 extra', twoExtras: '2 extras', threeExtras: '3 extras', fourExtras: '4 extras',
    beforeCountdown: 'Before countdown', startImmediately: 'Start immediately', second: '1 second', seconds2: '2 seconds', seconds3: '3 seconds',
    countdown: 'Countdown', noCountdown: 'No countdown', seconds5: '5 seconds', seconds10: '10 seconds',
    minimumReview: 'Minimum photo review', noLock: 'No lock', reviewHelp: 'Guided mode locks Use and Retake briefly so the guest can see the photo.',
    originalQuality: 'Original photo quality', finalQuality: 'Final print JPEG quality', recommended: 'recommended', qualityHelp: 'Higher quality uses more disk space.', finalQualityHelp: 'Applied to the composed file sent to the printer later.',
    cameraAria: 'Camera',
    templateClassicName: 'Classic strip', templateClassicDescription: 'Four portraits, stacked.', templateClassicPrint: '2 × 6 in strip',
    templateGridName: 'Six-frame grid', templateGridDescription: 'Three rows, two columns.', templateGridPrint: '4 × 6 in postcard',
    templatePortraitName: 'Full portrait', templatePortraitDescription: 'One photograph, generous scale.', templatePortraitPrint: '4 × 6 in postcard',
    selectedFramePreview: 'Selected frame preview', photoPlan: 'You will take {min}-{max} photos, then choose the final {required}.',
    capturedPhotoOptions: 'Captured photo options', capturedPhoto: 'Captured photo {index}', capturedPhotoInSlot: ', currently in slot {slot}', slotLabel: 'Slot {slot}', available: 'Available', photoCount: '{count} photos',
    emptyPhotoPool: 'Your captured photos will appear here.', finalArrangement: 'Final frame arrangement. Select a slot to edit it.',
    reviewSummary: 'Your {required} frames have been composed into a {print} layout. Save keeps both the originals and final JPEG on this computer.',
    cameraErrorUnsupported: 'This device does not support camera access.', cameraErrorDenied: 'Camera permission was denied. Allow camera access in macOS and restart the session.', cameraErrorNotFound: 'No camera was found. Connect a camera or use the MacBook webcam.', cameraErrorOpenFailed: 'The selected camera could not be opened. Try another camera.',
    liveCameraPreview: 'Live camera preview', attemptsUsed: '{attempts} capture attempts used', unlimitedRetakeShort: 'unlimited retakes', maximumShort: '{limit} maximum',
    replaceFilledSlot: 'Replace photo in slot {slot}', remainingShotsReserved: 'All remaining shots are reserved for empty slots.', tapFilledSlot: 'Tap a filled slot to replace it.', chooseFinalBatch: 'You will choose the final frame after this batch.',
    threeLayouts: 'three layouts', guidedReview: 'guided review', madeOffline: 'made offline',
    cameraUnsupported: 'Camera unsupported', cameraStatusReady: 'Ready', welcomeScreen: 'Return to welcome screen',
    finalPhoto: 'Final photo', printSheet: '4 × 6 print sheet', twoUpPrintHelp: 'This sheet contains two identical strips on one 4 × 6 print, ready to cut.', singlePrintHelp: 'This print sheet matches the 4 × 6 output exactly.',
    finalReadyToSave: 'Your final photo and print sheet are ready to save.', savingSession: 'Saving originals, final photo, and print sheet…', sessionSaved: 'This session has been saved on this computer.', saveSession: 'Save session', printLayout: 'Print layout', copiesPerSheet: '{count} copies per sheet',
    motionLevel: 'Motion level', motionLow: 'Low · slower hardware', motionMedium: 'Medium · balanced', motionHigh: 'High · smoothest', motionHelp: 'Only affects UI transitions; it does not slow photo capture.'
  }
} as const

export function t(language: Language, key: keyof typeof messages.vi, values: Record<string, string | number> = {}): string {
  return messages[language][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
}

export function tr(language: Language, vietnamese: string, english: string): string {
  return language === 'vi' ? vietnamese : english
}

export function templateCopy(language: Language, id: string): TemplateCopy {
  const prefix = id === 'classic-4x1' ? 'templateClassic' : id === 'grid-3x2' ? 'templateGrid' : 'templatePortrait'
  return {
    name: t(language, `${prefix}Name` as keyof typeof messages.vi),
    description: t(language, `${prefix}Description` as keyof typeof messages.vi),
    printLabel: t(language, `${prefix}Print` as keyof typeof messages.vi)
  }
}

export function deviceName(language: Language, value: string): string {
  if (!value || value === 'No camera selected' || value === 'Chưa chọn máy ảnh' || value === messages.vi.noCamera || value === messages.en.noCamera) return t(language, 'noCamera')
  if (value === 'none' || value === 'No printer selected' || value === 'Chưa chọn máy in' || value === messages.vi.noPrinter || value === messages.en.noPrinter) return t(language, 'noPrinter')
  if (value === 'office-mock' || value === 'Office printer (mock)' || value === messages.vi.officePrinter || value === messages.en.officePrinter) return t(language, 'officePrinter')
  if (value === 'dnp-mock' || value === 'DNP DS620A (mock)' || value === messages.vi.dnpPrinter || value === messages.en.dnpPrinter) return t(language, 'dnpPrinter')
  return value
}
