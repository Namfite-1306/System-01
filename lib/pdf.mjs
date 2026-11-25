import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
export function pdfBuffer(analysis, sources) {
  const font = [
    process.env.PDF_FONT_PATH,
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ].find((p) => p && existsSync(p));
  if (!font) throw new Error('Cần cấu hình PDF_FONT_PATH trỏ đến font TTF có tiếng Việt.');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 56,
      bufferPages: true,
      info: { Title: analysis.title, Author: 'Research Studio' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font(font);
    doc.fillColor('#1a7563').fontSize(10).text('RESEARCH STUDIO  /  PERSONAL ANALYSIS');
    doc.moveDown(1.5);
    doc.fillColor('#152b2b').fontSize(23).text(analysis.title);
    doc.moveDown(0.7);
    doc
      .fillColor('#687676')
      .fontSize(9)
      .text(
        `Cập nhật: ${new Date(analysis.updated_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}  |  ${analysis.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}`,
      );
    doc.moveDown(1.5);
    for (const line of analysis.body.split('\n')) {
      const heading = line.match(/^(#{1,3})\s+(.+)/);
      if (heading) {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 130) doc.addPage();
        doc.moveDown(0.6);
        doc
          .fillColor('#152b2b')
          .fontSize(heading[1].length === 1 ? 17 : 13)
          .text(heading[2], { lineGap: 4 });
        doc.moveDown(0.4);
      } else {
        doc
          .fillColor('#293b3b')
          .fontSize(10.5)
          .text(line || ' ', { lineGap: 5 });
      }
    }
    if (sources.length) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 110) doc.addPage();
      doc.moveDown(1);
      doc.fontSize(14).fillColor('#152b2b').text('Nguồn tham khảo');
      doc.moveDown(0.5);
      sources.forEach((s, i) => {
        doc
          .fontSize(9)
          .fillColor('#293b3b')
          .text(`${i + 1}. ${s.title}`);
        if (s.url) doc.fillColor('#1a7563').text(s.url, { link: s.url, lineGap: 3 });
        doc.moveDown(0.6);
      });
    }
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor('#687676')
        .text(`Research Studio - ${i + 1} / ${range.count}`, 56, doc.page.height - 37, {
          lineBreak: false,
        });
    }
    doc.end();
  });
}
