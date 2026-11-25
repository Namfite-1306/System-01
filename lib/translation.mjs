import { NEWS_LOCALES, clean } from './news.mjs';
const fail = (text, status = 400) => Object.assign(new Error(text), { status });
export class Translator {
  constructor(request = fetch) {
    this.request = request;
    this.cache = new Map();
  }
  async translate(text, source) {
    if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text.trim()) > 500)
      throw fail('Hãy chọn một từ hoặc đoạn ngắn (tối đa 500 byte UTF-8).');
    if (!Object.hasOwn(NEWS_LOCALES, source)) throw fail('Chọn ngôn ngữ gốc để dịch.');
    text = text.trim();
    if (source === 'en')
      return { text, translation: text, source, target: 'en', provider: 'Already English' };
    const key = `${source}:${text}`,
      cached = this.cache.get(key);
    if (cached && Date.now() - cached.time < 86400000) return cached.result;
    const url = new URL('https://api.mymemory.translated.net/get');
    url.search = new URLSearchParams({
      q: text,
      langpair: `${source === 'zh' ? 'zh-CN' : source}|en`,
    });
    const response = await this.request(url, {
      signal: AbortSignal.timeout(18000),
      redirect: 'error',
    });
    if (!response.ok)
      throw fail('Dịch vụ dịch đang bận hoặc đã hết hạn mức miễn phí. Hãy thử lại sau.', 502);
    const data = await response.json();
    if (
      Number(data.responseStatus) !== 200 ||
      !data.responseData?.translatedText ||
      data.quotaFinished
    )
      throw fail('Không dịch được hoặc đã hết hạn mức MyMemory. Hãy thử lại sau.', 502);
    const result = {
      text,
      translation: clean(data.responseData.translatedText),
      source,
      target: 'en',
      provider: 'MyMemory',
    };
    if (this.cache.size >= 300) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, { time: Date.now(), result });
    return result;
  }
}
