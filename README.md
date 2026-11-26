# Research Studio

## Triển khai Vercel và Supabase

Project Supabase dùng cho bản web là `https://ozxiphcwcgpwukffehlt.supabase.co`.
Địa chỉ Vercel là `https://system-01-topaz.vercel.app`.

1. Trong Supabase SQL Editor, chạy toàn bộ `supabase/003_multi_user.sql`.
   Bảng `research_feed_records` chứa tin RSS chung. Bảng `research_user_records`
   chứa bài lưu, case, bản nháp, hồ sơ và hệ sinh thái theo tài khoản.
   Chính sách RLS kiểm tra `owner_id = auth.uid()` cho đọc và ghi.
2. Trong Supabase Authentication → URL Configuration, đặt Site URL thành
   `https://system-01-topaz.vercel.app`. Thêm các Redirect URL
   `https://system-01-topaz.vercel.app/login.html` và
   `https://system-01-topaz.vercel.app/login.html?reset=1`.
   Bật Email provider. Đăng ký gửi email xác nhận. Cấu hình SMTP riêng và hạn mức
   gửi phù hợp khi mở đăng ký cho người dùng thật.
3. Trong Vercel, chọn Framework Preset **Other** và Root Directory là thư mục gốc
   của repository GitHub `Namfite-1306/System-01`. `vercel.json` khai báo build,
   đầu ra `dist`, API Node.js 24, vùng Singapore và lịch RSS.
4. URL Supabase và publishable key đã khai báo công khai trong `vercel.json`.
   Trong Environment Variables của Vercel, thêm `SUPABASE_SERVICE_ROLE_KEY`
   và `CRON_SECRET` cho Production để chạy lịch RSS. Lấy service_role JWT key ở
   Supabase Settings → API Keys → Legacy API Keys. Dùng một chuỗi bí mật ngẫu nhiên
   tối thiểu 32 ký tự cho CRON_SECRET. Bật các biến tương ứng cho Preview nếu cần thử cron.
   API của người dùng xác thực bằng Supabase Auth và truy cập database bằng JWT
   của chính người dùng. Service-role key chỉ dùng trong tác vụ RSS phía máy chủ.
5. Commit và push từ VS Code. Vercel build bằng `npm run build`. Sau deploy,
   `/api/config` trả cấu hình công khai và trang `/login.html` cho đăng nhập,
   tạo tài khoản, đặt lại mật khẩu. `/api/health` yêu cầu phiên đăng nhập hợp lệ.
6. Lịch `0 23 * * *` chạy hằng ngày vào khoảng 06 giờ Việt Nam. Vercel Hobby có
   độ lệch thời gian trong giờ được lên lịch. Nút **Lấy tin mới** và tìm tin Internet
   chạy theo yêu cầu của người đang đăng nhập. Các tác vụ dùng `waitUntil`, tối đa
   300 giây trên cấu hình này. Tìm kiếm lớn có thể cần thử lại với ít ngôn ngữ
   hoặc khoảng thời gian ngắn hơn nếu chạm giới hạn.

Kiểm tra sau deploy bằng hai tài khoản riêng. Tài khoản A lưu tin, tạo case và
bản nháp, sau đó đăng nhập B để kiểm tra kho riêng của B. Trang `/portfolio/{id}`
chỉ lấy snapshot của bài đã bấm xác nhận xuất bản. Dữ liệu SQLite trên máy có thể
xuất JSON ở Nguồn & thiết lập. Việc chuyển dữ liệu đó vào tài khoản Supabase cần
một bước nhập dữ liệu riêng.

Tham khảo [Vercel Functions](https://vercel.com/docs/functions),
[Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing) và
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Hệ thống nghiên cứu cá nhân chạy local: RSS → sự kiện → bản đồ liên kết → case → bài phân tích → PDF / portfolio.

## Chạy ngay trên máy này

Node.js 24 trở lên. Trong thư mục `research-studio`, chạy:

```powershell
npm ci
npm start
```

Mở http://127.0.0.1:4318. Hoặc chạy `start.ps1` trong PowerShell. Dừng bằng Ctrl+C. Không cần Supabase, n8n hoặc OpenAI để sử dụng luồng theo mẫu.

1. Bàn tin tức → **Lấy tin mới**. Bốn nguồn được cấu hình: BBC Business, BBC World, VnExpress Kinh doanh, VnExpress Thế giới.
2. Mở sự kiện để xem link nguồn, ngày đăng và chủ đề được nhận diện bằng từ khóa.
3. Dòng sự kiện / Bản đồ liên kết → khám phá các sự kiện cùng chủ đề; thêm quan hệ kèm bằng chứng khi cần.
4. **Tạo case** → chọn theo mẫu hoặc AI. Hồ sơ học tập chỉnh ở Nguồn & thiết lập.
5. **Bắt đầu phân tích** → viết, lưu bản nháp, xem trước, xuất PDF.
6. **Xuất bản local** → duyệt phiên bản hiện tại; bài xuất hiện ở Portfolio và `/portfolio/{id}`. Website portfolio hiện có chưa được thay đổi.

## Dữ liệu và chế độ vận hành

- SQLite lưu ở `data/research.sqlite`, không nằm trong Git. Dữ liệu còn sau khi khởi động lại. File `.env` local đã đặt lịch lấy RSS mỗi 60 phút; lịch chỉ chạy khi server và máy đang hoạt động.
- Bản sao JSON tải từ Nguồn & thiết lập. Chưa có chức năng restore JSON; để phục hồi SQLite, dừng server rồi khôi phục bản sao thư mục `data/`.
- Tin RSS là dữ liệu nguồn, chưa được xác minh độc lập. Chỉ lấy tiêu đề, mô tả RSS và URL. Không vượt paywall, không lấy toàn văn.
- `occurred_at` được giữ là null nếu ngày xảy ra chưa xác định. Timeline hiện dùng ngày đăng nguồn.
- Gom bài theo URL chuẩn hóa và tiêu đề chuẩn hóa giống nhau. Gom cùng sự kiện bằng ngữ nghĩa, vector search và trích xuất thực thể bằng AI chưa nằm trong MVP.
- Đồ thị dùng SVG tương tác. Nhấn một sự kiện để xem nguồn. “Cùng đề cập” là liên hệ từ khóa; giả thuyết, nhận định của nguồn và quan hệ được người dùng xác nhận có trạng thái riêng.
- Dữ liệu mẫu chỉ được thêm khi chọn **Thêm tình huống mẫu**, luôn gắn nhãn và tách khỏi đồ thị dữ liệu thật. Không gửi bài mẫu đến webhook portfolio ngoài.
- Case lưu bản sao nguồn và hồ sơ, cùng `cutoff_at`. Thay đổi tin hoặc hồ sơ sau đó không sửa đề cũ.
- Bài có revision; yêu cầu ghi đè phiên bản cũ bị từ chối. AI phản biện không thể gắn nhầm vào revision đã thay đổi.

## Cấu hình

`.env` được Git bỏ qua. Có thể sao chép `.env.example` rồi chỉnh các trường cần thiết. Không gửi key vào chat hoặc đặt vào JS frontend.

| Biến | Công dụng |
|---|---|
| `OPENAI_API_KEY` | Mở tạo case và phản biện AI |
| `OPENAI_MODEL` | Mặc định `gpt-4.1-mini`; đổi theo model được tài khoản cho phép |
| `INGEST_INTERVAL_MINUTES` | 0 = tắt, >=15 = lấy RSS định kỳ khi server đang chạy |
| `STUDIO_API_TOKEN` | Bearer token cho API; bắt buộc nếu mở server ra ngoài loopback |
| `HOST` / `PORT` | Mặc định `127.0.0.1` / `4318` |
| `PDF_FONT_PATH` | Font Unicode TTF; tự tìm Arial trên Windows và DejaVu trên Linux |
| `PORTFOLIO_WEBHOOK_URL` | Endpoint HTTPS nhận bài sau khi bạn duyệt xuất bản |
| `PORTFOLIO_WEBHOOK_TOKEN` | Bearer token phía máy chủ cho endpoint portfolio |

Khởi động lại server sau khi chỉnh `.env`. Chế độ theo mẫu hoạt động độc lập và không được gắn nhãn AI. API AI chưa được kiểm tra bằng tài khoản thật trong lần build này. `store:false` được gửi khi gọi Responses API; không nên diễn giải điều này là không có bất kỳ chính sách lưu giữ nào phía nhà cung cấp.

Để chạy một server suốt ngày, giữ tiến trình Node hoạt động hoặc dùng Docker với `restart: unless-stopped`. Lịch local không chạy khi máy tắt/ngủ. Không bật cả lịch local và n8n nếu không muốn lấy RSS hai lần.

## n8n local (tùy chọn)

Docker chưa được cài hoặc xác nhận trên máy trong lần build này. Đã chuẩn bị cấu hình và workflow, chưa chạy n8n thực tế.

1. Cài Docker Desktop từ nhà cung cấp, cấu hình `STUDIO_API_TOKEN` ngẫu nhiên trong `.env`.
2. Nếu server Node đang chiếm port 4318, dừng nó trước khi chạy stack Docker.
3. Chạy `docker compose up -d --build` trong thư mục này.
4. Mở http://localhost:5678 và hoàn tất thiết lập tài khoản n8n.
5. Import `workflows/01-collect-rss.json`. Tạo credential **Header Auth**: Name `Authorization`, Value `Bearer <STUDIO_API_TOKEN>`. Chọn credential tại HTTP Request node.
6. Chạy thử rồi publish/activate workflow. Lịch là mỗi giờ, múi giờ Asia/Ho_Chi_Minh. Workflow gọi `http://studio:4318/api/ingest`; API trả job id và xử lý nền, xem kết quả trên dashboard.
7. Workflow `02-create-case-api.json` cung cấp webhook tạo case. Cấu hình credential Header Auth riêng cho Webhook vào và credential studio cho HTTP Request ra. POST JSON `{"event_id":"...","mode":"template"}` hoặc `"ai"`. Response 202 chứa job id; kiểm tra `/api/jobs/{id}`.

Nếu chỉ chạy n8n trong Docker còn Node trên Windows, đổi host trong HTTP Request thành `http://host.docker.internal:4318`, đặt HOST phù hợp và token. Cấu hình firewall theo môi trường của bạn; không tắt kiểm tra token. Image n8n `latest` tiện cho local; ghim version đã kiểm tra trước khi triển khai lâu dài. Workflow JSON chưa được import/kiểm thử trên n8n thực tế.

## Quy trình làm việc

### Consulting và copywriting

Chọn **Consulting** hoặc **Copywriting** trên Bàn tin tức / thư viện. Khi tạo đề, có thể đổi hướng cho riêng đề đó. Consulting có khung vấn đề, issue tree, giả thuyết, định lượng, lựa chọn và lộ trình. Copywriting có brief đối tượng, mục tiêu, kênh, giọng điệu, hook và CTA. Theo mẫu hoạt động không cần AI; AI tạo đề/phản biện cần số dư API. Các đề mới lưu track và brief tại thời điểm tạo, khung viết và rubric tương ứng. Bài cũ không bị sửa; bài chưa có track được hiển thị trong Consulting. Thư viện case và bài viết lọc theo hướng, portfolio vẫn hiển thị toàn bộ bài đã duyệt. Đây là bài luyện tập; không giả định khách hàng đã giao hoặc duyệt brief.

### Đọc báo và thao tác bản đồ

Nhấn tiêu đề tin để mở link nguồn trong tab mới (Google News có thể chuyển tiếp sang báo). Nút **Hồ sơ nguồn** mở bản tóm tắt và danh sách nguồn trong Studio. Bản đồ hỗ trợ kéo từng nút, kéo nền, cuộn để thu/phóng, nút +/− và **Đặt lại bố cục**. Khi nút được focus, phím mũi tên di chuyển nút; khi nền bản đồ được focus, phím mũi tên di chuyển vùng nhìn. Vị trí được giữ khi đổi trang trong phiên hiện tại; tải lại trang sẽ trở về bố cục ban đầu. Việc kéo chỉ đổi vị trí hiển thị, không tạo hoặc xác nhận quan hệ giữa các tin.

### Tìm tin mới theo từ khóa

Trên Bàn tin tức, mở **Tìm thêm tin từ Internet**, nhập từ khóa trong mục **Tìm tin mới theo từ khóa**, chọn 24 giờ/7 ngày/30 ngày rồi bấm **Tìm & lưu tin mới**. Backend đọc Google News RSS tiếng Việt và tiếng Anh, tìm cụm từ có dấu ngoặc kép, chỉ giữ bài có đủ từ khóa trong tiêu đề/mô tả (không phân biệt dấu và chữ hoa). Kết quả lọc thời gian, chống trùng URL, sắp mới nhất trước rồi giới hạn 80 bài. Bài chỉ nhắc từ khóa trong toàn văn có thể bị loại; không đảm bảo toàn bộ tin mới nhất trên web đều có trong feed. Kết quả được lưu để tạo case và bài phân tích. Google News RSS là nguồn tổng hợp bên ngoài, có thể thay đổi hoặc ngừng hoạt động; không đảm bảo bao phủ toàn bộ báo chí. Liên kết có thể là link chuyển tiếp Google News. Chỉ lấy tiêu đề, mô tả và link, không tải toàn văn. Ô tìm kiếm cũ chỉ lọc thư viện đã lưu.

API: `POST /api/search-news` với `{ "query": "ngân hàng Việt Nam", "days": 7 }`, trả job HTTP 202; đọc kết quả bằng `GET /api/jobs/{id}`. Không gọi AI và không cần API key tìm kiếm.

## Chuyển sang Supabase

1. Tạo một project mới hoặc chọn project dành riêng cho hệ thống này.
2. Chạy `supabase/schema.sql` trong SQL Editor.
3. Đặt `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong `.env`, khởi động lại server.
4. Đặt `DATABASE_BACKEND=auto` và khởi động lại để sử dụng Supabase khi cả hai biến tồn tại. `DATABASE_BACKEND=sqlite` giữ dữ liệu local dù đã điền key. Dữ liệu SQLite cũ **không tự chuyển**; giữ bản sao trước khi đổi. Schema MVP dùng bản ghi JSON theo loại; chưa tối ưu cho kho dữ liệu lớn.

RLS bật và quyền anon/authenticated bị thu hồi trên bảng nghiên cứu. Service-role chỉ ở backend. Không dùng key service-role trong frontend hoặc portfolio công khai. Supabase adapter và migration đã được chuẩn bị nhưng chưa chạy trên project thật.

## API

Nếu có token, mọi `/api/*` yêu cầu `Authorization: Bearer ...`. Browser lưu token trong sessionStorage, không lưu OpenAI key.

| Method | Endpoint | Kết quả |
|---|---|---|
| GET | `/api/health`, `/api/state` | Trạng thái và dữ liệu dashboard |
| GET | `/api/events?q=&topic=&from=&to=` | Danh sách sự kiện |
| GET | `/api/events/{id}`, `/api/events/{id}/graph` | Hồ sơ nguồn và graph |
| POST | `/api/ingest` | 202 + job id |
| GET | `/api/jobs/{id}` | pending/running/succeeded/failed |
| POST | `/api/cases` | `{event_id,mode,track,brief}` → 202 + job id |
| POST | `/api/analyses` | `{case_id}` → bản nháp |
| PATCH | `/api/analyses/{id}` | `{title,body,revision}` → revision mới |
| POST | `/api/analyses/{id}/review` | 202 + job id, cần AI key |
| GET | `/api/analyses/{id}/pdf` | PDF có tiếng Việt |
| POST | `/api/analyses/{id}/publish` | `{confirm:true,revision}` |
| POST | `/api/relationships` | `{from,to,label,status,reason,evidence_ids}` |
| PATCH | `/api/profile`, `/api/sources/{id}` | Hồ sơ học tập / bật tắt nguồn |
| GET | `/api/export`, `/api/portfolio` | Backup / bài đã xuất bản |

Webhook portfolio nhận `{id,title,body,revision,sources,cutoff_at}`. Không có endpoint nhận mặc định trên website portfolio hiện tại; cần xây endpoint đó hoặc tích hợp CMS trước khi cấu hình. Thất bại webhook không đánh dấu bài đã xuất bản.

## Kiểm tra

```powershell
npm run check
npm test
npm run format:check
```

Test chạy database in-memory và server loopback, không gọi AI trả phí. Kiểm tra RSS/Atom, dữ liệu case bất biến, chống ghi đè, AI thiếu cấu hình, PDF Unicode, xuất bản có duyệt, escape nội dung và yêu cầu bằng chứng quan hệ.

## Phạm vi tiếp theo

Tích hợp OpenAI thật, chạy n8n và Supabase khi có tài khoản, gom sự kiện theo ngữ nghĩa có đánh giá chất lượng, thêm nguồn đáng tin cậy, endpoint CMS portfolio thật, xác thực theo người dùng và tìm kiếm/pagination cho dữ liệu lớn. Không coi bản local hiện tại là dịch vụ multi-user sẵn sàng public.

## Bản tối ưu local ngày 22/10/2026

- Menu Case & brief / Bài viết luôn mở thư viện; nút Tiếp tục viết mở đúng bài và hướng làm việc.
- Tìm Internet và tổng quan được thu gọn; thẻ tin hiển thị tên nguồn. Dòng thời gian tải thêm từng 20 tin.
- Ctrl/Command+S lưu bản nháp; bản xem trước hiển thị heading và escape HTML. Nội dung chưa lưu được giữ trong sessionStorage để khôi phục khi mở lại bài trong cùng phiên trình duyệt. Đây không phải bản sao lưu lâu dài.
- API client có timeout, thông báo lỗi mạng và thay token hết hạn một lần; render phản hồi cũ không ghi đè trang mới.
- Hàng đợi trong một tiến trình giữ thao tác crawl/search không ghi đè liên kết; mở bản nháp đồng thời dùng lại cùng bản. SQLite có index và busy timeout. Hàng đợi này không thay thế điều phối nhiều server.
- Dashboard chỉ gửi 30 nhật ký gần nhất dạng rút gọn. API job và JSON export vẫn giữ kết quả đầy đủ.
- `npm run check` kiểm tra cú pháp tất cả module; `npm run format` định dạng; `npm run format:check` kiểm tra định dạng. API/UI helpers tách ở dist/api.js, dist/ui-utils.js; graph ở dist/graph.js.
- Đã kiểm tra tìm Deloitte thật, menu thư viện, consulting/copywriting, xem trước và thu/phóng graph; kiểm tra viewport desktop/mobile. Chưa xác thực AI trả phí, Supabase và n8n trong đợt này. Không thay hai bộ tiêu chuẩn nội dung đang chờ bàn tiếp.
## Hệ sinh thái và lịch sử 5 năm (27/10/2026)

- Mở **Tìm thêm tin từ Internet**, nhập tên công ty và chọn **5 năm gần nhất**. Backend chia 5 cửa sổ theo năm, tìm Việt/Anh; giữ tối đa 40 bài phù hợp mỗi cửa sổ/ngôn ngữ (tối đa 400 bài tổng) để tin mới không chiếm hết kết quả cũ. RSS không bảo đảm đầy đủ lịch sử; metadata có thể thiếu. Tin crawl cũ không tự được phân loại vào hồ sơ.
- Trên thẻ tin nhấn **Thêm vào hệ sinh thái** → chọn hồ sơ đã có hoặc hồ sơ mới, đặt tên. Một tin có thể thuộc nhiều hồ sơ; thêm lại không tạo trùng.
- Menu **Hệ sinh thái** → mở công ty. Lọc ngày từ/đến (UTC), từ khóa; nút **Tháng trước** là tháng dương lịch trước, **Năm trước** là năm dương lịch trước. Chọn ngày cụ thể để so thời điểm bất kỳ. Ngày hiển thị trên tin là ngày đăng.
- **Thêm liên kết / Sửa liên kết**: chọn hai tin, tên quan hệ, trạng thái và giải thích/bằng chứng. Graph hiển thị liên kết thủ công của riêng hồ sơ; kéo nút không thay nội dung quan hệ. Graph tối đa 60 tin mới nhất trong bộ lọc, dòng thời gian có tải thêm.
- **Bỏ khỏi hồ sơ** gỡ tư cách thành viên và liên kết liên quan trong hồ sơ đó, giữ nguyên tin gốc và các hồ sơ khác. **Xóa liên kết** không xóa tin. Hai thao tác này hỏi xác nhận trong UI.
- SQLite dùng cấu trúc record sẵn có, không cần migration. Nếu dùng Supabase đã tạo bảng trước đây, chạy `supabase/002_ecosystems.sql` trên đúng project trước khi dùng. Không tự chuyển dữ liệu local lên Supabase.
- Backup JSON `/api/export` bao gồm records.ecosystem. API mới: POST `/api/ecosystems` ({name,event_id?}); GET/PATCH `/api/ecosystems/:id`; POST `/api/ecosystems/:id/members` ({event_id}); DELETE `/api/ecosystems/:id/members/:eventId`; POST/PATCH/DELETE `/api/ecosystems/:id/links[/:linkId]` ({from,to,label,status,reason}). Mọi API dùng cơ chế token hiện có.
- Các liên kết có nhãn “đã kiểm tra” vẫn là đánh giá của người dùng, không phải xác minh độc lập. Bộ tiêu chuẩn chọn tin/ra đề chưa được thay đổi.

## Nguồn tin đa ngôn ngữ và dịch khi bôi đen

- RSS: Việt (VnExpress), Anh (BBC), Trung (RTHK 財經), Đức (Tagesschau Wirtschaft), Pháp (Le Monde Économie), Tây Ban Nha (EL PAÍS Economía). Bật/tắt từng báo trong Nguồn & thiết lập.
- Trong **Tìm thêm tin từ Internet**, chọn **Nguồn tìm kiếm** cạnh từ khóa: Việt + Anh, tất cả 6 ngôn ngữ, hoặc từng ngôn ngữ. Bộ chọn này điều khiển vùng/ngôn ngữ của Google News; từ khóa không tự dịch. Với tiếng Trung có thể dùng 黑石 thay cho Blackstone. Kết quả vẫn kiểm tra từ khóa và ngày đăng. Đây không phải bộ máy tìm toàn bộ kho báo chí.
- **Nguồn tin** cạnh ô lọc thư viện chỉ lọc các tin đã lưu theo ngôn ngữ. Bài cũ chưa có metadata ngôn ngữ có thể chỉ xuất hiện khi chọn Tất cả; tìm lại bài sẽ bổ sung metadata.
- Bôi đen từ/đoạn ngắn trong thẻ tin hoặc hồ sơ nguồn để dịch sang tiếng Anh. Hộp dịch cho đổi ngôn ngữ gốc khi cần. Hỗ trợ kéo chuột và Shift + phím điều hướng. Không áp dụng trong trang báo gốc mở ở tab khác.
- Dịch dùng GET API MyMemory (không cần API key, không dùng tín dụng OpenAI). Chỉ đoạn được chọn được gửi tới dịch vụ; tối đa 500 byte UTF-8, hạn mức miễn phí của nhà cung cấp có thể thay đổi. Bản dịch được cache trong RAM tối đa 300 đoạn/24 giờ, không ghi thành bản dịch bài báo. API báo lỗi rõ ràng khi hết hạn mức hoặc mất kết nối. Máy chủ cần Internet.
- API: POST /api/search-news với {"query":"Blackstone","days":7,"languages":["de","fr"]}; POST /api/translate với {"text":"Wirtschaft","source":"de"}. Giữ cơ chế STUDIO_API_TOKEN hiện có khi được cấu hình.
- Tham khảo dịch vụ: https://mymemory.translated.net/doc/spec.php . Không có thay đổi .env hoặc migration SQL bắt buộc cho các trường metadata này.

## Landing page thử nghiệm — Obsidian & Lime

Mở /landing.html để xem trang giới thiệu theo mẫu nền obsidian, điểm nhấn #ccff00, glass blur 16px và bố cục bento. Trang sử dụng font Space Grotesk và JetBrains Mono lưu trong dist/fonts, kèm giấy phép OFL. Các nút mở trực tiếp chức năng đang có tại /#events, /#ecosystems, /#cases, /#analyses, /#portfolio và /#settings. Sơ đồ và thẻ tin trên landing là minh họa, không phải dữ liệu cập nhật trực tiếp. Trang không gọi AI hoặc gửi dữ liệu ra ngoài. Có liên kết xem bản thử ở footer ứng dụng; trang gốc / vẫn là workspace.

## Theme workspace — Obsidian & Lime

Workspace mặc định dùng nền obsidian, accent lime #ccff00, font local và các bề mặt kính blur 16px. Theme nằm riêng trong dist/workspace-theme.css; dist/theme.js bật/tắt stylesheet qua nút ◐ trên topbar. Chọn giao diện sáng để đối chiếu với bản cũ, chọn Obsidian & Lime để quay lại. Lựa chọn được lưu bằng localStorage workspace-theme (classic / obsidian); nếu trình duyệt chặn lưu trữ, nút vẫn hoạt động trong trang hiện tại. Theme áp dụng cho thẻ tin, form, nguồn, case, editor, graph và popup dịch, không đổi dữ liệu hay API. Landing page dùng thiết kế riêng và không chịu ảnh hưởng của nút này.

## Hiệu ứng thẻ — MagicBento

Hiệu ứng trong dist/card-effects.js và dist/card-effects.css áp dụng trang trí lên các thẻ hiện có (tin, case, portfolio, thống kê, hướng làm việc và panel). Bổ sung spotlight theo chuột, viền sáng, 12 hạt trên thẻ đang hover, nghiêng tối đa khoảng 1 độ, dịch chuyển tối đa 1.5px và ripple khi bấm; không đổi lưới, nội dung hoặc chức năng. Màu lime theo theme tối, xanh lá theo theme sáng. Sử dụng DOM/CSS và requestAnimationFrame, không thêm React/GSAP vào ứng dụng hiện tại.

Overlay không nhận pointer events, không đọc được bởi trình đọc màn hình và không nằm trong thứ tự bàn phím. Các thẻ chứa form hoặc graph không nghiêng; tạm dừng nghiêng khi bôi đen, cuộn hoặc thao tác điều khiển. Hover chỉ chạy khi dùng chuột phù hợp, dọn hạt khi rời thẻ/đổi trang. Tôn trọng prefers-reduced-motion. Các thẻ mới sau render được gắn hiệu ứng qua enhanceCards.

## Hiệu ứng thanh tìm kiếm, nút và điều hướng

- Radiant: viền conic gradient xoay 5 giây cho ô lọc thư viện, tìm tin Internet và lọc hệ sinh thái. Tăng glow khi focus/hover; giữ giá trị, label, Enter và disabled hiện có. Trình duyệt không hỗ trợ @property hiển thị gradient tĩnh.
- Cursor glow: gradient/viền sáng dùng biến --glow-x và --glow-y theo con trỏ trên các nút đang có; không thêm nút mic, đính kèm hoặc hành động mới.
- Rising pill: nền ellipse dâng lên trên mục sidebar, tab chủ đề và chọn hướng làm việc. Giữ cấu trúc menu và trạng thái active; có cùng phản hồi khi focus bàn phím. Giữ nhãn đầy đủ khi thanh điều hướng cuộn ngang trên màn hình nhỏ.
- Mã nằm riêng trong dist/interaction-effects.css và dist/interaction-effects.js, gắn lại sau render. Không thêm React/GSAP, không đổi dữ liệu hoặc API. Hỗ trợ theme sáng/tối, prefers-reduced-motion, forced-colors và bỏ hover glow trên thiết bị chỉ cảm ứng.

## Ngôn ngữ giao diện Việt / English

Nút VI/EN (biểu tượng 文) trên topbar chuyển ngôn ngữ giao diện và ghi nhớ bằng localStorage studio-ui-language. Đây là thiết lập giao diện, độc lập với ngôn ngữ nguồn báo và ngôn ngữ tạo case trong hồ sơ học tập. Từ điển UI nằm trong dist/ui-messages.js; dist/ui-language.js cập nhật nhãn, placeholder, aria-label và các thông báo UI được khai báo sau mỗi lần render. Nội dung báo, tiêu đề/nội dung bản nháp, nội dung case và hồ sơ công ty được giữ nguyên. Việc chuyển ngôn ngữ không gửi tài liệu tới dịch vụ dịch, không gọi AI, không tải lại trang và không ghi dữ liệu vào backend.

Các giá trị biểu mẫu và option được giữ nguyên khi chỉ đổi nhãn hiển thị, tránh đổi logic lọc/lưu hồ sơ. Giao diện thay đổi cả html lang và định dạng ngày cho các lần render tiếp theo. Chuỗi mới cần bổ sung vào từ điển; thông báo từ nhà cung cấp hoặc nội dung phân tích do người dùng/AI tạo không được tự động dịch.
