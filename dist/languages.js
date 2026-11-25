export const LANGUAGES = {
  vi: 'Tiếng Việt',
  en: 'Tiếng Anh',
  zh: 'Tiếng Trung',
  de: 'Tiếng Đức',
  fr: 'Tiếng Pháp',
  es: 'Tiếng Tây Ban Nha',
};
export function sourceLanguage(article) {
  return (
    article.language ||
    article.primary_language ||
    (article.source_id?.startsWith('bbc')
      ? 'en'
      : article.source_id?.startsWith('vnexpress')
        ? 'vi'
        : '')
  );
}
