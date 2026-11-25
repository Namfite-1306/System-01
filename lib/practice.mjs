export const TRACKS = ['consulting', 'copywriting'];
export function practiceCase(event, profile, track, brief = {}) {
  const context = event.summary || event.title;
  if (track === 'copywriting')
    return {
      title: `Content brief: ${event.title}`,
      role: 'Copywriter / Content strategist',
      context,
      decision: `Xây thông điệp cho ${brief.audience || 'độc giả quan tâm chủ đề này'} trên ${brief.channel || 'LinkedIn'}, nhằm ${brief.objective || 'giải thích diễn biến và tạo sự quan tâm'}.`,
      questions: [
        'Người đọc đang gặp vấn đề gì? Insight nào là giả thuyết cần kiểm chứng?',
        'Thông điệp chính, lợi ích cho người đọc và bằng chứng hỗ trợ là gì?',
        'Viết ba hướng hook; chọn một hướng và giải thích lựa chọn.',
        'CTA phù hợp là gì? Có tuyên bố nào cần kiểm chứng trước khi gửi khách hàng?',
      ],
      deliverables: [
        'Brief: đối tượng, mục tiêu, thông điệp, giọng điệu và kênh',
        '3 hook / headline và một bản nội dung hoàn chỉnh',
        'CTA, biến thể để thử nghiệm và checklist kiểm chứng',
      ],
      assumptions: [
        'Bài luyện tập dựa trên tin RSS, không phải brief được khách hàng duyệt.',
        `Giọng điệu: ${brief.tone || 'Rõ ràng, đáng tin cậy'}. Không bịa số liệu, testimonial hoặc cam kết sản phẩm.`,
      ],
      rubric: [
        { criterion: 'Insight và phù hợp đối tượng', points: 25 },
        { criterion: 'Thông điệp, hook và cấu trúc', points: 30 },
        { criterion: 'Độ chính xác và bằng chứng', points: 25 },
        { criterion: 'Giọng điệu, CTA và khả năng thử nghiệm', points: 20 },
      ],
    };
  return {
    title: `Consulting case: ${event.title}`,
    role: 'Consultant / Business analyst',
    context,
    decision:
      brief.objective ||
      'Bạn tư vấn cho ban lãnh đạo quyết định gì trước diễn biến này? Đề xuất một lựa chọn với giả định và kế hoạch kiểm chứng.',
    questions: [
      'Xác định vấn đề, người ra quyết định, mục tiêu và phạm vi.',
      'Dựng issue tree: các nhánh không trùng lặp, bao phủ vấn đề; ưu tiên giả thuyết cần kiểm chứng.',
      'Ước lượng tác động lên doanh thu, chi phí hoặc thị trường. Nêu công thức và dữ liệu còn thiếu.',
      'So sánh các lựa chọn theo tác động, khả thi và rủi ro. Điều gì làm thay đổi khuyến nghị?',
    ],
    deliverables: [
      'Executive summary: khuyến nghị trước, lập luận sau',
      'Issue tree, giả thuyết và kế hoạch thu thập dữ liệu',
      'Bảng kịch bản với giả định định lượng rõ ràng',
      'Khuyến nghị và lộ trình 30/60/90 ngày với KPI',
    ],
    assumptions: [
      'Đây là case luyện tập; không có khách hàng thật hoặc dữ liệu nội bộ được xác nhận.',
      'Tin RSS là điểm khởi đầu. Đọc nguồn gốc và kiểm chứng trước khi dùng số liệu.',
    ],
    rubric: [
      { criterion: 'Định nghĩa và cấu trúc vấn đề', points: 25 },
      { criterion: 'Bằng chứng và phân tích định lượng', points: 30 },
      { criterion: 'Khuyến nghị và tính khả thi', points: 30 },
      { criterion: 'Giao tiếp và giới hạn', points: 15 },
    ],
  };
}
export function practiceDraft(track) {
  return track === 'copywriting'
    ? '# Creative brief\n\nĐối tượng / mục tiêu / kênh / giọng điệu / thông điệp chính.\n\n## Insight và bằng chứng\n\nTách insight đã có bằng chứng khỏi giả thuyết.\n\n## 3 hook / headline\n\n1. ...\n2. ...\n3. ...\n\n## Bản nội dung\n\nViết bản hoàn chỉnh cho kênh đã chọn.\n\n## CTA và biến thể\n\nHành động mong muốn và phiên bản để thử nghiệm.\n\n## Checklist trước khi gửi\n\nKiểm chứng số liệu, claim, nguồn và độ phù hợp giọng điệu.'
    : '# Executive summary\n\nKhuyến nghị chính, lý do và tác động dự kiến.\n\n## Vấn đề và mục tiêu\n\nAi quyết định, quyết định gì, tiêu chí thành công?\n\n## Issue tree và giả thuyết\n\nChia nhánh vấn đề; ưu tiên giả thuyết cần kiểm chứng.\n\n## Bằng chứng và định lượng\n\nNguồn, công thức, giả định, dữ liệu còn thiếu.\n\n## Lựa chọn và kịch bản\n\nSo sánh tác động, khả thi và rủi ro.\n\n## Khuyến nghị và lộ trình 30/60/90 ngày\n\nHành động, người phụ trách và KPI.\n\n## Rủi ro và giới hạn\n\nĐiều gì có thể làm thay đổi kết luận?';
}
