// أدوات المتشابهات: بناء خريطة «آية ← شبيهاتها» من ملف الأزواج،
// ومحاذاة كلمات آيتين لتلوين مواضع الفروق في ورقة المقارنة
import { normalizeArabic } from './quran';

export type SimilarPair = [string, string];

// أزواج ["2:48","2:123"] ← خريطة تجاور بالاتجاهين، والشبيهات بترتيب المصحف
export function buildAdjacency(pairs: SimilarPair[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const [a, b] of pairs) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const order = (k: string) => {
    const [s, y] = k.split(':').map(Number);
    return s * 1000 + y;
  };
  for (const list of adj.values()) list.sort((x, y) => order(x) - order(y));
  return adj;
}

// محاذاة كلمات آيتين (LCS على النص المطبَّع): لكل كلمة هل هي مشتركة أم فرق يُلوَّن.
// كلمات علامات الوقف (تطبيعها فارغ) تُعتبر مشتركة حتى لا تُلوَّن بلا معنى.
export function diffFlags(aText: string, bText: string): [boolean[], boolean[]] {
  const aw = aText.split(/\s+/).filter(Boolean);
  const bw = bText.split(/\s+/).filter(Boolean);
  const an = aw.map(normalizeArabic);
  const bn = bw.map(normalizeArabic);
  const W = bn.length + 1;
  const dp = new Array((an.length + 1) * W).fill(0);
  for (let i = 1; i <= an.length; i++) {
    for (let j = 1; j <= bn.length; j++) {
      dp[i * W + j] =
        an[i - 1] === bn[j - 1]
          ? dp[(i - 1) * W + j - 1] + 1
          : Math.max(dp[(i - 1) * W + j], dp[i * W + j - 1]);
    }
  }
  const aFlags = new Array(an.length).fill(false);
  const bFlags = new Array(bn.length).fill(false);
  let i = an.length;
  let j = bn.length;
  while (i > 0 && j > 0) {
    if (an[i - 1] === bn[j - 1]) {
      aFlags[i - 1] = true;
      bFlags[j - 1] = true;
      i--;
      j--;
    } else if (dp[(i - 1) * W + j] >= dp[i * W + (j - 1)]) {
      i--;
    } else {
      j--;
    }
  }
  // علامات الوقف الصغيرة ليست فرقاً حقيقياً
  for (let x = 0; x < an.length; x++) if (an[x] === '') aFlags[x] = true;
  for (let x = 0; x < bn.length; x++) if (bn[x] === '') bFlags[x] = true;
  return [aFlags, bFlags];
}

// تقسيم نص الآية إلى كلمات للعرض (نفس تقسيم diffFlags)
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
