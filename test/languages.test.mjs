import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEWS_LOCALES,
  SOURCES,
  searchSource,
  validateLanguages,
  matchesSearch,
  parseFeed,
} from '../lib/news.mjs';
import { Translator } from '../lib/translation.mjs';
test('Six source languages preserve locale and metadata; Chinese matches without whitespace', () => {
  assert.equal(Object.keys(NEWS_LOCALES).length, 6);
  for (const language of Object.keys(NEWS_LOCALES)) {
    const source = searchSource('Blackstone', 7, language);
    assert.equal(new URL(source.url).searchParams.get('ceid'), NEWS_LOCALES[language].ceid);
    const [article] = parseFeed(
      '<rss><channel><item><title>Example</title><link>https://example.org/a</link></item></channel></rss>',
      source,
    );
    assert.equal(article.language, language);
    assert.ok(SOURCES.some((s) => s.language === language));
  }
  assert.throws(() => validateLanguages(['invalid']));
  assert.throws(() => validateLanguages([]));
  assert.throws(() => validateLanguages('de'));
  assert.deepEqual(validateLanguages(['fr', 'fr']), ['fr']);
  assert.equal(matchesSearch({ title: '黑石集团投资人工智能', summary: '' }, '黑石'), true);
});
test('Translation bounds UTF8 bytes, caches successful results and reports quota failures', async () => {
  let calls = 0;
  const translator = new Translator(async (url) => {
    calls++;
    assert.equal(url.hostname, 'api.mymemory.translated.net');
    assert.equal(url.searchParams.get('langpair'), 'de|en');
    return {
      ok: true,
      json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Economy' } }),
    };
  });
  assert.equal((await translator.translate('Wirtschaft', 'de')).translation, 'Economy');
  await translator.translate('Wirtschaft', 'de');
  assert.equal(calls, 1);
  await assert.rejects(translator.translate('汉'.repeat(167), 'zh'), /500/);
  await assert.rejects(translator.translate('word', 'xx'), /ngôn ngữ/);
  assert.equal((await translator.translate('Finance', 'en')).translation, 'Finance');
  assert.equal(calls, 1);
  const exhausted = new Translator(async () => ({
    ok: true,
    json: async () => ({ responseStatus: 429, responseData: { translatedText: 'QUOTA EXCEEDED' } }),
  }));
  await assert.rejects(exhausted.translate('bonjour', 'fr'), /hạn mức/);
});
