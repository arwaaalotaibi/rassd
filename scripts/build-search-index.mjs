// يبني فهرس بحث موحّد لكل آيات المصحف من نص «الإملائي» (الرسم الحديث) في quran.com،
// فيطابق ما يكتبه المستخدم بلا رسم عثماني. لكل آية { k: "سورة:آية", p: الصفحة, t: نص الآية }
// الاستخدام: node scripts/build-search-index.mjs
import { writeFile } from 'node:fs/promises';

const TOTAL_PAGES = 604;

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

async function fetchPage(p) {
  const url = `https://api.qurancdn.com/api/qdc/verses/by_page/${p}?fields=text_imlaei&per_page=50`;
  const data = await fetchJson(url);
  return data.verses.map((v) => ({
    k: v.verse_key,
    p: v.page_number ?? p,
    t: (v.text_imlaei || '').trim(),
  }));
}

const all = [];
const BATCH = 10;
for (let start = 1; start <= TOTAL_PAGES; start += BATCH) {
  const batch = [];
  for (let p = start; p <= Math.min(start + BATCH - 1, TOTAL_PAGES); p++) batch.push(fetchPage(p));
  const results = await Promise.all(batch);
  for (const r of results) all.push(...r);
  const done = Math.min(start + BATCH - 1, TOTAL_PAGES);
  if (done % 100 < BATCH) console.log(`... ${done}/${TOTAL_PAGES}`);
}

// إزالة التكرار (آية قد تظهر في نتيجة صفحتين) وترتيب حسب السورة ثم الآية
const seen = new Map();
for (const v of all) if (!seen.has(v.k)) seen.set(v.k, v);
const index = [...seen.values()].sort((a, b) => {
  const [sa, aa] = a.k.split(':').map(Number);
  const [sb, ab] = b.k.split(':').map(Number);
  return sa - sb || aa - ab;
});

await writeFile(
  new URL('../public/quran/search-index.json', import.meta.url).pathname,
  JSON.stringify(index)
);
console.log(`✅ فهرس البحث: ${index.length} آية`);
