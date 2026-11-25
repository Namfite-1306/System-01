import { mkdir, writeFile } from 'node:fs/promises';
import { pdfBuffer } from '../lib/pdf.mjs';
await mkdir(new URL('../test-artifacts/', import.meta.url), { recursive: true });
const body =
  '# Kết luận chính\n\nĐây là tài liệu kiểm tra giao diện PDF, không phải bài phân tích cá nhân đã xuất bản.\n\n## Bối cảnh và bằng chứng\n\nTiếng Việt: nghiên cứu, nguồn dữ liệu, lãi suất, tỷ giá, chuỗi cung ứng.\n\n' +
  Array.from(
    { length: 12 },
    (_, i) =>
      `## Kịch bản ${i + 1}\n\n${'Phân biệt dữ kiện đã xác nhận, giả định và điều chưa biết. Kiểm tra cơ chế tác động, phương án thay thế và chỉ số theo dõi. '.repeat(3)}`,
  ).join('\n\n');
const data = await pdfBuffer(
  {
    title: 'Kiểm tra xuất PDF tiếng Việt',
    body,
    status: 'draft',
    updated_at: new Date().toISOString(),
  },
  [{ title: 'Tài liệu kiểm tra bố cục', url: 'https://example.com/' }],
);
await writeFile(new URL('../test-artifacts/pdf-check.pdf', import.meta.url), data);
console.log('Wrote PDF QA sample.');
