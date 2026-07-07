// يبني قاعدة المتشابهات اللفظية من فهرس البحث الموجود — بلا أي خدمة خارجية:
// يقارن الآيات بعد التطبيع (بلا حركات) ويعتبر آيتين متشابهتين إذا تطابق نصهما
// أو كانت نسبة أطول تسلسل كلمات مشترك (LCS) عالية. الناتج أزواج مفاتيح فقط
// [["2:48","2:123"], …] والنصوص تُقرأ في المتصفح من فهرس البحث نفسه.
// الاستخدام: node scripts/build-mutashabihat.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const idx = JSON.parse(
  readFileSync(new URL('../public/quran/search-index.json', import.meta.url), 'utf8')
);

// نفس تطبيع lib/quran.ts (normalizeArabic)
function norm(s) {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

const keys = idx.map((e) => e.k);
const toks = idx.map((e) => norm(e.t).split(' ').filter(Boolean));
const N = idx.length;

// أطول تسلسل كلمات مشترك بين آيتين (برمجة ديناميكية)
function lcs(a, b) {
  const dp = new Array((a.length + 1) * (b.length + 1)).fill(0);
  const W = b.length + 1;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i * W + j] =
        a[i - 1] === b[j - 1]
          ? dp[(i - 1) * W + j - 1] + 1
          : Math.max(dp[(i - 1) * W + j], dp[i * W + j - 1]);
    }
  }
  return dp[a.length * W + b.length];
}

// فهرس معكوس لثلاثيات الكلمات → مرشّحو التشابه (بدل مقارنة ١٩ مليون زوج)
const shingleMap = new Map();
for (let i = 0; i < N; i++) {
  const t = toks[i];
  for (let s = 0; s + 3 <= t.length; s++) {
    const sh = t.slice(s, s + 3).join(' ');
    let list = shingleMap.get(sh);
    if (!list) shingleMap.set(sh, (list = []));
    list.push(i);
  }
}

const SIM_THRESHOLD = 0.55; // نسبة LCS إلى طول الأطول
const MIN_COMMON = 3; // أقل تسلسل مشترك
const MIN_RUN = 5; // أو: مقطع متصل مشترك بهذا الطول فأكثر (تشابه جزئي يُخلط في التسميع)
const MAX_TWINS = 10; // أقصى شبيهات معروضة لكل آية

// أطول مقطع كلمات متصل مشترك بين آيتين
function longestRun(a, b) {
  let best = 0;
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const cur = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = cur;
    }
  }
  return best;
}

const pairSim = new Map(); // "i:j" -> sim
const counted = new Map(); // عدّاد الثلاثيات المشتركة لكل زوج

for (const list of shingleMap.values()) {
  if (list.length < 2 || list.length > 150) continue; // ثلاثيات شائعة جداً تُستبعد
  for (let x = 0; x < list.length; x++) {
    for (let y = x + 1; y < list.length; y++) {
      const key = list[x] * 100000 + list[y];
      counted.set(key, (counted.get(key) ?? 0) + 1);
    }
  }
}

for (const [key, shared] of counted) {
  const i = Math.floor(key / 100000);
  const j = key % 100000;
  const a = toks[i];
  const b = toks[j];
  const minLen = Math.min(a.length, b.length);
  if (shared < (minLen <= 6 ? 1 : 2)) continue;
  const common = lcs(a, b);
  const sim = common / Math.max(a.length, b.length);
  if (common >= MIN_COMMON && sim >= SIM_THRESHOLD) {
    pairSim.set(key, sim);
  } else if (shared >= MIN_RUN - 2 && longestRun(a, b) >= MIN_RUN) {
    // تشابه جزئي: مقطع متصل طويل مشترك وإن اختلفت بقية الآية
    pairSim.set(key, 0.5 + longestRun(a, b) / 100);
  }
}

// تطابق نصي كامل للآيات القصيرة (كلمتان+) التي لا تدخل فهرس الثلاثيات
const exact = new Map();
for (let i = 0; i < N; i++) {
  if (toks[i].length < 2 || toks[i].length > 3) continue;
  const t = toks[i].join(' ');
  let list = exact.get(t);
  if (!list) exact.set(t, (list = []));
  list.push(i);
}
for (const list of exact.values()) {
  if (list.length < 2) continue;
  for (let x = 0; x < list.length; x++) {
    for (let y = x + 1; y < list.length; y++) {
      pairSim.set(list[x] * 100000 + list[y], 1);
    }
  }
}

// قصّ الشبيهات: أعلى ١٠ لكل آية (بالتشابه) حتى لا تنفجر مجموعات التكرار الحرفي
const adj = new Map();
for (const [key, sim] of pairSim) {
  const i = Math.floor(key / 100000);
  const j = key % 100000;
  (adj.get(i) ?? adj.set(i, []).get(i)).push([j, sim]);
  (adj.get(j) ?? adj.set(j, []).get(j)).push([i, sim]);
}
const kept = new Set();
for (const [i, list] of adj) {
  list.sort((a, b) => b[1] - a[1]);
  for (const [j] of list.slice(0, MAX_TWINS)) {
    kept.add(i < j ? i * 100000 + j : j * 100000 + i);
  }
}

const pairs = [...kept].map((key) => [
  keys[Math.floor(key / 100000)],
  keys[key % 100000],
]);

writeFileSync(
  new URL('../public/quran/mutashabihat.json', import.meta.url),
  JSON.stringify(pairs)
);

// إحصاء تحقق
const versesWithTwins = new Set();
for (const [a, b] of pairs) {
  versesWithTwins.add(a);
  versesWithTwins.add(b);
}
console.log(`✅ أزواج المتشابهات: ${pairs.length}`);
console.log(`✅ آيات لها شبيهات: ${versesWithTwins.size} من ${N}`);
const has = (a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
console.log('تحقق 2:48↔2:123:', has('2:48', '2:123') ? '✓' : '✗');
console.log('تحقق 6:151؟ عينة أخرى 17:110؟ —');
