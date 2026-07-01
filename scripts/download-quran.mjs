// تحميل بيانات المصحف (٦٠٤ صفحات) من quran.com CDN وحفظها كملفات JSON خفيفة
// الاستخدام: node scripts/download-quran.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = new URL('../public/quran/pages/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function downloadPage(p) {
  const file = `${OUT}${p}.json`;
  if (existsSync(file)) return 'skip';
  const url = `https://api.qurancdn.com/api/qdc/verses/by_page/${p}?words=true&word_fields=text_qpc_hafs,line_number&per_page=50&fields=chapter_id,verse_key`;
  const data = await fetchJson(url);
  // نحتفظ بالحد الأدنى من الحقول لتصغير الحجم
  const verses = data.verses.map((v) => ({
    key: v.verse_key,
    chapter: v.chapter_id,
    words: v.words.map((w) => ({
      id: `${v.verse_key}:${w.position}`,
      text: w.text_qpc_hafs,
      line: w.line_number,
      type: w.char_type_name, // word | end (رقم الآية)
    })),
  }));
  await writeFile(file, JSON.stringify({ page: p, verses }));
  return 'ok';
}

// أسماء السور للتنقّل
const chaptersUrl = 'https://api.qurancdn.com/api/qdc/chapters?language=ar';
const ch = await fetchJson(chaptersUrl);
const chapters = ch.chapters.map((c) => ({
  id: c.id,
  name: c.name_arabic,
  pages: c.pages, // [أول صفحة، آخر صفحة]
  verses: c.verses_count,
}));
await writeFile(
  new URL('../public/quran/chapters.json', import.meta.url).pathname,
  JSON.stringify(chapters)
);
console.log(`chapters.json ✓ (${chapters.length} سورة)`);

let done = 0;
const BATCH = 10;
for (let start = 1; start <= 604; start += BATCH) {
  const batch = [];
  for (let p = start; p <= Math.min(start + BATCH - 1, 604); p++) batch.push(downloadPage(p));
  await Promise.all(batch);
  done = Math.min(start + BATCH - 1, 604);
  if (done % 100 < BATCH) console.log(`... ${done}/604`);
}
console.log('اكتمل تحميل صفحات المصحف ✓');
