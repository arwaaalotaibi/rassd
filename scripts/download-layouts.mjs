// تنزيل مخططات المصاحف الإضافية (الباكستاني ١٥ و١٦ سطراً) من quran.com CDN
// الاستخدام: node scripts/download-layouts.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const LAYOUTS = [
  { key: 'indopak15', mushaf: 6, totalPages: 610 },
  { key: 'indopak16', mushaf: 7, totalPages: 548 },
];

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

for (const layout of LAYOUTS) {
  const OUT = new URL(`../public/quran/${layout.key}/`, import.meta.url).pathname;
  await mkdir(OUT, { recursive: true });
  const chapterRanges = {}; // سورة → [أول صفحة، آخر صفحة]

  const downloadPage = async (p) => {
    const file = `${OUT}${p}.json`;
    let data;
    if (existsSync(file)) {
      const { readFile } = await import('node:fs/promises');
      data = JSON.parse(await readFile(file, 'utf8'));
    } else {
      const url = `https://api.qurancdn.com/api/qdc/verses/by_page/${p}?mushaf=${layout.mushaf}&words=true&word_fields=text_indopak,line_number&per_page=60&fields=chapter_id,verse_key,juz_number`;
      const raw = await fetchJson(url);
      data = {
        page: p,
        juz: raw.verses[0]?.juz_number ?? null,
        verses: raw.verses.map((v) => ({
          key: v.verse_key,
          chapter: v.chapter_id,
          words: v.words.map((w) => ({
            id: `${v.verse_key}:${w.position}`,
            text: w.text_indopak,
            line: w.line_number,
            type: w.char_type_name,
          })),
        })),
      };
      await writeFile(file, JSON.stringify(data));
    }
    for (const v of data.verses) {
      const r = chapterRanges[v.chapter] ?? [p, p];
      r[0] = Math.min(r[0], p);
      r[1] = Math.max(r[1], p);
      chapterRanges[v.chapter] = r;
    }
  };

  const BATCH = 10;
  for (let start = 1; start <= layout.totalPages; start += BATCH) {
    const jobs = [];
    for (let p = start; p <= Math.min(start + BATCH - 1, layout.totalPages); p++) {
      jobs.push(downloadPage(p));
    }
    await Promise.all(jobs);
    const done = Math.min(start + BATCH - 1, layout.totalPages);
    if (done % 100 < BATCH) console.log(`${layout.key}: ${done}/${layout.totalPages}`);
  }

  await writeFile(`${OUT}chapters.json`, JSON.stringify(chapterRanges));
  console.log(`${layout.key} اكتمل ✓ (${Object.keys(chapterRanges).length} سورة)`);
}
console.log('تم تنزيل جميع المخططات ✓');
