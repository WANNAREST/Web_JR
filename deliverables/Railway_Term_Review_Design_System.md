# Railway Term Review — Design System

> Phiên bản 1.0 · Desktop-first · Ngôn ngữ tài liệu: tiếng Việt

## Phạm vi và giả định

Tài liệu này định nghĩa nền tảng thiết kế cho hệ thống nội bộ giúp reviewer Nhật Bản kiểm tra thuật ngữ trong tài liệu đường sắt. Trạng thái nghiệp vụ là `未判定`, `JR固有用語`, `JR固有用語ではない`, `判断保留`. Điểm BERT là dữ liệu xác suất/điểm mô hình, **không phải** quyết định nghiệp vụ.

Figma “Chatbot y tế” chỉ là tham chiếu visual. Tài liệu này không tái sử dụng chatbot, nội dung y tế, cấu trúc hội thoại, lịch sử chat hay source panel của template.

## 1. Phân tích Figma tham chiếu

| Quan sát trong Figma | Nguyên tắc visual trích xuất | Áp dụng cho Railway Term Review | Không tái sử dụng |
|---|---|---|---|
| Surface trắng trên nền neutral rất nhạt; border mảnh | Phân vùng rõ mà không nặng dashboard | Candidate list, evidence, catalog dùng surface trắng và border `#E2E8F0` | Canvas hồng, branding y tế |
| Layout desktop chia cột với khoảng đệm 24px | Một task chính, các vùng phụ đọc được độc lập | Review Desk: danh sách candidate + vùng quyết định/bằng chứng | Sidebar lịch sử trò chuyện và khung chat |
| Input 48px, list item cao khoảng 40px, icon 24px | Kích thước thao tác ổn định và dễ scan | Search/filter 40–44px; action chính 44px; icon 20/24px | Nút gửi tin nhắn |
| Accent cyan dùng ít cho liên kết/trạng thái chọn | Accent dẫn hướng, không thay semantic state | Cyan cho focus, selected, link/metadata; không dùng cho quyết định review | Màu/ý nghĩa chatbot |
| Component states Default/Hover/Select được tách rõ | State là một phần của component contract | Tất cả row, button, tab, filter có state rõ ràng | Component chat/history nguyên bản |
| Typography nhỏ, thoáng, hierarchy nhẹ | Tăng khả năng đọc dữ liệu dày | Metadata 12–13px, body 14–16px, title 20–28px | Copywriting và nội dung y tế |

## 2. Design vision

### Product personality

**Bình tĩnh, chính xác, có trách nhiệm.** Đây là công cụ nghiệp vụ để ra quyết định có truy vết, không phải AI workspace hay dashboard công nghiệp. AI chỉ hỗ trợ ưu tiên đọc; reviewer luôn là người quyết định.

### Nguyên tắc thiết kế

1. **Câu nguồn trước, PDF sau.** Reviewer đọc ngữ cảnh văn bản trước; PDF xác minh trực quan ở đúng trang.
2. **Một candidate, một quyết định rõ.** Decision dock luôn ở vùng nhìn thấy, không bắt reviewer cuộn để bấm.
3. **Scan trước, đọc sâu sau.** Danh sách dùng term, trạng thái, frequency, score; câu dài là dòng phụ có truncate.
4. **Semantic không chỉ bằng màu.** Mọi trạng thái có icon, nhãn chữ và màu.
5. **Tôn trọng tiếng Nhật.** Không hard-code tiếng Anh khi chọn 日本語; không ép tên file/câu nguồn dài vào một dòng không thể đọc.
6. **Không làm reviewer mất ngữ cảnh.** Review xong tự chuyển candidate `未判定` kế tiếp; PDF và sentence chuyển theo candidate mới.

### Cần tránh

- Gradient, glassmorphism, AI sparkle, animation gây phân tán.
- Màu xanh/đỏ phủ kín row để biểu thị quyết định.
- Modal cho thao tác quyết định thường xuyên.
- Hai danh sách cuộn lồng nhau, sidebar cố định quá hẹp, hoặc PDF là nội dung đầu tiên.
- Dùng score BERT như “đúng/sai”; score chỉ để sắp xếp/đánh giá độ tin cậy.

## 3. Information architecture và flow

| Khu vực | Mục tiêu | Nội dung/chức năng chính |
|---|---|---|
| Upload & Extract | Đưa tài liệu vào pipeline | Dropzone, danh sách file, preset Broad/Standard/Strict, tiến trình, cảnh báo upload trùng |
| 抽出済み文書 | Tiếp tục không chạy BERT lại | Card tài liệu, số candidate, số `未判定`, ngày extract, mở Review Desk |
| Review Desk | Ra quyết định theo từng tài liệu | Candidate list, decision dock, source sentence, PDF trang đích, metadata, Export CSV |
| 判定済み用語 | Tra cứu kết quả theo cặp term + document | Filter theo trạng thái, thông tin tài liệu/trang, lịch sử, export training CSV/JSONL |
| Export | Xuất dữ liệu có truy vết | CSV tài liệu gồm tất cả candidate; CSV/JSONL training chỉ gồm record phù hợp training |

### Luồng review chuẩn

`Chọn tài liệu → candidate 未判定 đầu tiên → đọc 原文の該当文 → xác nhận PDF trang đích → chọn trạng thái → (ghi chú nếu cần) → lưu → tự chọn 未判定 kế tiếp`.

- Nếu candidate đã review: hiển thị trạng thái, `確認者`, thời điểm; có thể đổi quyết định theo quyền.
- Nếu PDF unavailable: vẫn cho review dựa trên câu nguồn nhưng hiển thị warning và lý do.
- Nếu không còn `未判定`: hiển thị completion state và CTA tới `判断保留` hoặc `判定済み用語`.

## 4. Layout system

### Desktop (≥ 1280px)

- Page max-width: 1600px; gutter ngoài: 32px; khoảng cách section: 24px.
- Header: cao 72px. Navigation cấp 2: 48px.
- Review Desk: grid `minmax(360px, 38%) minmax(620px, 62%)`; height theo viewport, không cố định pixel tuyệt đối.
- Candidate panel: header/filter cố định trong panel; list cuộn độc lập.
- Evidence panel: Decision dock sticky ở đầu; source rail + sentence ở trên; PDF ở dưới, tối thiểu 420px cao.

### Tablet (768–1279px)

- Grid `42% / 58%`; metadata rail có thể wrap hai hàng.
- Decision buttons vẫn một hàng nếu mỗi button ≥ 132px; nếu không, chuyển grid 2+1.
- PDF 48vh, không thấp hơn 360px.

### Mobile (< 768px)

- Candidate list là màn chính; Evidence mở thành overlay/full-screen có nút đóng.
- Decision dock sticky phía trên overlay; sentence trước PDF.
- PDF mở full-screen/overlay riêng khi cần thao tác zoom; không nhúng một khung PDF quá thấp.
- Không dùng hover làm điều kiện để lộ action.

### Quy tắc sticky/layer

| Thành phần | Hành vi |
|---|---|
| Header | sticky toàn trang, z-index 20 |
| Filter/list header | sticky trong candidate panel, z-index 2 |
| Decision dock | sticky trong evidence panel, z-index 3 |
| PDF overlay mobile | fixed, z-index 50 |
| Dialog | fixed, z-index 60 |
| Toast | fixed, z-index 70 |

## 5. Design tokens

### 5.1 Color

| Token | Hex | Dùng cho | Không dùng cho |
|---|---:|---|---|
| `color.brand.700` | `#164E63` | Header, primary action nền tối | Trạng thái review |
| `color.brand.600` | `#0E7490` | Primary hover, active nav | Text body dài |
| `color.accent.500` | `#0891B2` | Focus ring, selected outline, link | Approved/rejected/hold |
| `color.surface.canvas` | `#F7F9FC` | Nền app | Card |
| `color.surface.default` | `#FFFFFF` | Card, panel, input | Selected row mạnh |
| `color.surface.subtle` | `#F1F5F9` | Filter bar, metadata | Decision semantic |
| `color.text.primary` | `#17212B` | Heading, term, body chính | Disabled |
| `color.text.secondary` | `#52606D` | Metadata | Alert/danger |
| `color.text.muted` | `#7B8794` | Placeholder | Nội dung chính |
| `color.border.default` | `#D9E2EC` | Border card/input | Focus |
| `color.focus` | `#0EA5E9` | Focus 2px + offset 2px | Semantic success |
| `color.success.700` | `#166534` | `JR固有用語` text/icon | Primary brand |
| `color.success.50` | `#F0FDF4` | Approved badge background | Whole-row fill liên tục |
| `color.danger.700` | `#B42318` | `JR固有用語ではない` | Delete mặc định |
| `color.danger.50` | `#FEF3F2` | Rejected badge background | Câu nguồn |
| `color.warning.700` | `#92400E` | `判断保留` | Primary CTA |
| `color.warning.50` | `#FFFBEB` | Hold badge background | Score badge |
| `color.disabled` | `#CBD5E1` | Disabled border/icon | Text có thể đọc |

Contrast: text chính trên surface ≥ 7:1; text metadata ≥ 4.5:1; outline focus luôn nhìn thấy trên cả nền trắng và selected.

### 5.2 Typography

| Token | Font/size/line-height | Dùng cho |
|---|---|---|
| `font.family.jp` | `"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif` | Toàn bộ UI tiếng Nhật |
| `type.display` | 28/36, 700 | Page title |
| `type.h2` | 22/30, 700 | Panel title |
| `type.h3` | 18/26, 700 | Term/section |
| `type.body` | 15/26, 400–500 | Câu nguồn, note |
| `type.ui` | 14/20, 500 | Button, input, select |
| `type.meta` | 12/18, 500 | Page, time, frequency |
| `type.data` | 14/20, 600, tabular numbers | Score, count, timestamp |

- Câu nguồn tiếng Nhật: line-height 1.8–1.9; không căn đều (justify).
- Term dài: tối đa 2 dòng ở card/list; tooltip/copy đầy đủ ở detail.
- File name: truncate 1 dòng trên list, full name trong title và metadata detail.

### 5.3 Spacing, radius, shadow, icon, motion

| Nhóm | Giá trị |
|---|---|
| Spacing | 4, 8, 12, 16, 24, 32, 40, 48px |
| Radius | 4px (input/badge), 8px (card/button), 12px (modal) |
| Elevation | `shadow.0: none`; `shadow.1: 0 1px 2px rgba(15,23,42,.08)`; `shadow.2: 0 8px 24px rgba(15,23,42,.12)` |
| Icon | 16px metadata, 20px action, 24px navigation |
| Motion | 120ms hover/focus; 160ms panel; ease-out; `prefers-reduced-motion: reduce` tắt transform |

## 6. Component inventory

| Component | Mục đích/anatomy | Variants & states | Accessibility / responsive / copy Nhật |
|---|---|---|---|
| Header | Brand, model state, language, account | default, compact tablet | Nav keyboard; `表示言語`; không chỉ báo model bằng chấm màu |
| Language switcher | `日本語` / `EN` | selected, focus, disabled | group label; hit area 40px |
| Navigation tabs | Upload, extracted docs, reviewed catalog | default, hover, active | `aria-current`; mobile scroll ngang |
| Upload dropzone | icon, title, format/limit, browse | idle, drag-over, files, error, uploading | keyboard browse; `ファイルを選択、またはここにドロップ` |
| File list | name, size, remove | default, remove hover, error | tên file đầy đủ accessible; remove 40px |
| Preset control | Broad/Standard/Strict + helper | default, selected, disabled | radio semantics; `標準（推奨）` |
| Saved document card | filename, counts, time, CTA | default, hover, selected, empty | toàn card clickable; 2-line filename; `確認作業を再開` |
| Candidate row | term, status, frequency, score, sentence preview | default, hover, selected, reviewed | role option/listbox; Enter/Space chọn; score `0.9997` |
| Score badge | score đơn sắc, tabular number | high/medium/low; no semantic decision | luôn 4 chữ số: `1.0000`; tooltip “抽出スコア” |
| Status badge | icon + label + semantic color | 未判定/approved/rejected/hold | text bắt buộc; không dùng màu đơn lẻ |
| Search/filter | icon, input/select, clear | default, focus, filled, disabled | label không chỉ placeholder; mobile wrap |
| Buttons | icon tùy chọn + text | primary, secondary, ghost, danger; hover/focus/loading/disabled | min 44px, không chỉ icon với action quan trọng |
| Export button | download icon + CSV | default, disabled, loading | `CSVを出力`; xuất toàn bộ candidate document, không theo filter |
| Decision buttons | icon, status text, optional shortcut | 4 semantic actions incl. reset | sticky; confirm reset; `JR固有用語` etc. |
| Review note | label, helper, textarea, count | empty, focus, filled, error | `判定メモ（任意）`; 2000 char max |
| Source metadata rail | file, page, term | normal, long filename | label/value rõ; truncation có title |
| Source sentence | heading, sentence, highlighted term | default, long, unavailable | trước PDF; lang=`ja`; đọc được 15/26 |
| PDF container | toolbar/open full screen, viewer, unavailable | loading, ready, unavailable | iframe title; mở `#page=n`; mobile overlay |
| Candidate facts | score/frequency/type | standard | grid 3 cột desktop / 1 cột mobile |
| Reviewed list item | term + document + page + decision | default/hover/selected | key theo document+term, không gộp term giữa PDF |
| History item | before → after, reviewer, time, note | default/empty | thứ tự mới nhất trước; icon + text state |
| Empty/loading/error | icon, title, actionable CTA | no candidates/docs/terms; loading; request error | câu ngắn, không đổ lỗi; retry khi hợp lý |
| Toast | result message + dismiss | success/error/info | `role=status`/`alert`; 5–8s, không che decision |
| Duplicate dialog | filename/hash match, counts, 2 actions | default, processing | focus trap; `確認作業を再開` / `再抽出する` |

## 7. Quy tắc dữ liệu và content

| Dữ liệu | Quy tắc hiển thị |
|---|---|
| Score | `Number(score).toFixed(4)` ở badge, facts và CSV: `0.9800`, `0.9997`, `1.0000` |
| Filename | List: 1–2 dòng + ellipsis; detail/tooltip: đầy đủ; không xuống layout khác |
| Term | List tối đa 2 dòng; detail không truncate nếu còn không gian |
| Câu nguồn | Ưu tiên đọc; preview 2 dòng trong list; full trong panel; highlight term không làm đổi nghĩa |
| PDF page | `p. 55` (EN) / `55頁` hoặc `p. 55` (JA), luôn khớp sentence occurrence |
| Frequency | `× 4`; không coi frequency là score |
| Reviewer/time | `確認者: 山田 太郎 · 2026/08/01 14:30` |
| Note | Rỗng hiển thị “メモなし” ở detail, không render vùng lớn vô ích |
| Multiple occurrences | Detail hiển thị occurrence đại diện (score cao nhất) trước; danh sách occurrence còn lại mở khi cần |
| PDF unavailable | `この文書に対応するPDFはありません。`; vẫn giữ sentence/page nếu có |
| CSV | UTF-8 BOM; escape formula; xuất toàn bộ term của document với status, score, frequency, page, source sentence, note |

## 8. Localization và copywriting

| Nhật | English | Ghi chú dùng |
|---|---|---|
| 未判定 | Unreviewed | Chưa có quyết định |
| JR固有用語 | JR-specific term | Quyết định dương tính nghiệp vụ |
| JR固有用語ではない | Not a JR-specific term | Không dùng `対象外` vì mơ hồ |
| 判断保留 | Needs review | Cần xem lại, không phải reject |
| 判定済み用語 | Reviewed terminology | Bao gồm cả positive/rejected/hold |
| 抽出済み文書 | Extracted documents | Đã chạy BERT và lưu kết quả |
| 出典情報 | Source information | File, page, term |
| 出典箇所 | Source occurrences | Câu/trang occurrence |
| 判定状態 | Decision status | Filter/status label |
| 確認者 | Reviewer | Người đã review |
| 確認作業を再開 | Resume review | CTA cho document đã extract |

Giữ nguyên BERT, PDF, CSV, JSONL, API, ms. Tất cả copy visible/aria label phải nằm trong i18n; không hard-code `SOURCE TRACE`, `REVIEWED TERMINOLOGY`, `WORKFLOW` khi UI là 日本語.

## 9. Accessibility và usability checklist

- [ ] Text/body đạt WCAG AA 4.5:1; text lớn đạt 3:1; focus ring 3:1.
- [ ] Tab order: header → navigation → filter → candidate list → decision → evidence; Escape đóng overlay/dialog.
- [ ] Arrow Up/Down đổi candidate khi focus ở list; Enter/Space mở/chọn.
- [ ] Mọi status có icon, label và màu; không chỉ dùng green/red.
- [ ] Button/action chính ≥ 44×44px; icon-only có accessible name/tooltip.
- [ ] Focus không bị che bởi sticky header/dock.
- [ ] Noto Sans JP/fallback hỗ trợ glyph Nhật; body ≥ 15px, line-height ≥ 1.7 cho sentence.
- [ ] Reset `未判定に戻す` cần confirmation, nêu rõ mất trạng thái hiện tại nhưng giữ note theo chính sách.
- [ ] Session dài: list position ổn định, autosave chỉ khi có yêu cầu rõ, toast không che nút decision.
- [ ] Mobile: PDF overlay có close rõ, không lock reviewer vào iframe; swipe không thay thế điều khiển keyboard.

## 10. Hướng dẫn áp dụng vào Figma

### Cấu trúc file/page

1. `00 Cover & principles`
2. `01 Foundations` — color, type, spacing, elevation, icons, motion
3. `02 Components` — component set và variants
4. `03 Patterns` — Review Desk, Export, duplicate dialog, errors
5. `04 Screens` — Upload, Extracted documents, Review Desk, Reviewed terminology
6. `05 Prototype` — happy path, hold, PDF unavailable, duplicate upload

### Naming

- Variables: `color/semantic/success/text`, `space/24`, `type/body/regular`.
- Components: `Button/Primary`, `Badge/Decision`, `CandidateRow`, `ReviewDesk/DecisionDock`.
- Variant properties: `state=default|hover|focus|disabled`, `decision=unreviewed|approved|rejected|hold`, `size=sm|md`.
- Không dùng `Frame 105`, `State4`, tên dự án y tế hay `chat`.

### Tạo trước

1. Tokens + typography; 2. Button/Input/Badge; 3. CandidateRow/DecisionDock/SourceSentence; 4. Review Desk desktop; 5. responsive overlay; 6. catalog/export/dialog.

## 11. Roadmap

| Priority | Vấn đề | Giải pháp | Tác động | Hoàn thành khi |
|---|---|---|---|---|
| P0 | Reviewer phải cuộn để quyết định/đọc source | Review Desk 2 cột, decision sticky, sentence trước PDF | Tăng tốc review, giảm lỗi ngữ cảnh | Review 20 candidate liên tiếp không cuộn toàn trang để bấm quyết định |
| P0 | PDF không khớp câu nguồn | Lưu/query cùng occurrence cho sentence+page; remount viewer theo `#page` | Tin cậy bằng chứng | Mỗi candidate kiểm thử mở đúng page của sentence |
| P0 | State/copy chưa nhất quán | Áp dụng glossary, i18n 100%, score 4 decimal web+CSV | Reviewer Nhật hiểu đúng | Không còn nhãn Anh hard-code trong 日本語; score CSV/web giống nhau |
| P0 | Catalog không thấy review theo document | Key theo `documentId + termId`; catalog/query/history theo document review | Không mất quyết định | 4 term review trong một doc hiện đủ ở catalog |
| P1 | Candidate list scan chậm | CandidateRow chuẩn, filter/search sticky, status icon+text, score tabular | Ít mệt, lọc nhanh | Reviewer tìm/lọc/đổi candidate bằng keyboard được |
| P1 | Export khó truy vết | CSV document đầy đủ + training export tách biệt | Dễ audit/train | CSV có score 4 decimal, page, sentence, status, note |
| P1 | Mobile/tablet khó đọc PDF | Evidence overlay/full-screen, responsive grid | Tiếp cận linh hoạt | Không có nested scroll gây kẹt trên viewport 768px |
| P2 | Thiếu đo lường UX | Event đo thời gian/candidate, hold rate, error/retry | Cải tiến dựa dữ liệu | Dashboard không lộ nội dung tài liệu, có metric tổng hợp |
| P2 | Power-user flow | Phím tắt có discoverability: A/R/H, nhưng tránh xung đột input | Nhanh hơn khi review lớn | Có toggle/help, shortcut không kích hoạt trong textarea |

## 12. Design decisions cần xác nhận

1. `JR固有用語` có nghĩa “chỉ riêng JR” hay “thuật ngữ chuyên môn dùng trong nghiệp vụ JR”? Nếu nghĩa thứ hai, đổi nhãn thành `JR専門用語`.
2. `判断保留` có được export vào training không? Khuyến nghị: không export cho binary training cho đến khi được quyết định.
3. Reset về `未判定` có giữ note và history hay xóa note? Khuyến nghị: giữ history, cho reviewer chọn giữ/xóa note.
4. Review catalog hiển thị từng `document + term` (khuyến nghị) hay cần thêm chế độ tổng hợp theo term trên nhiều tài liệu?
5. Reviewer có quyền ghi đè quyết định của người khác không, và có cần lý do bắt buộc khi đổi từ approved sang rejected?
