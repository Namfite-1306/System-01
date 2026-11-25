export const CASE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    role: { type: 'string' },
    context: { type: 'string' },
    decision: { type: 'string' },
    questions: { type: 'array', items: { type: 'string' } },
    deliverables: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    rubric: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { criterion: { type: 'string' }, points: { type: 'integer' } },
        required: ['criterion', 'points'],
      },
    },
  },
  required: [
    'title',
    'role',
    'context',
    'decision',
    'questions',
    'deliverables',
    'assumptions',
    'rubric',
  ],
};
export const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'strengths', 'issues', 'questions'],
};
export async function generateJSON({ key, model, schema, name, instructions, input }) {
  if (!key) {
    const e = new Error('Chưa cấu hình OPENAI_API_KEY ở máy chủ. Bạn có thể tạo case theo mẫu.');
    e.status = 409;
    throw e;
  }
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input: JSON.stringify(input),
      text: { format: { type: 'json_schema', name, strict: true, schema } },
      max_output_tokens: 3500,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) {
    const e = new Error(
      `OpenAI HTTP ${r.status}. Kiểm tra model, quyền truy cập và hạn mức trong tài khoản.`,
    );
    e.status = 502;
    throw e;
  }
  const data = await r.json();
  const content = (data.output ?? []).flatMap((o) => o.content ?? []);
  const text = content
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text)
    .join('');
  if (!text) throw new Error('OpenAI không trả về nội dung có cấu trúc');
  return JSON.parse(text);
}
export function templateCase(event, profile) {
  return {
    title: `Phân tích quyết định: ${event.title}`,
    role: profile.role || 'Chuyên viên chiến lược doanh nghiệp',
    context: event.summary || event.title,
    decision:
      'Bạn sẽ điều chỉnh chiến lược kinh doanh như thế nào trước diễn biến này trong 12 tháng tới?',
    questions: [
      'Điều gì đã được nguồn xác nhận, điều gì vẫn là giả thuyết?',
      'Diễn biến này có thể ảnh hưởng đến doanh thu, chi phí và dòng tiền qua các cơ chế nào?',
      'So sánh ba kịch bản và đề xuất hành động cùng chỉ số theo dõi.',
    ],
    deliverables: [
      'Executive summary tối đa 300 từ',
      'Bảng giả định và ba kịch bản',
      'Đề xuất hành động, KPI và nguồn tham khảo',
    ],
    assumptions: [
      'Đề theo mẫu, chưa sử dụng AI. Không có số liệu giả lập được trình bày như dữ kiện.',
    ],
    rubric: [
      { criterion: 'Chất lượng bằng chứng', points: 30 },
      { criterion: 'Lập luận và kịch bản', points: 30 },
      { criterion: 'Tính khả thi', points: 25 },
      { criterion: 'Trình bày và hạn chế', points: 15 },
    ],
  };
}
