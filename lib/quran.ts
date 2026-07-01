// أنواع بيانات المصحف وأدوات بناء الصفحة

export type Word = {
  id: string; // "سورة:آية:موضع"
  text: string;
  line: number;
  type: 'word' | 'end';
};

export type Verse = {
  key: string; // "سورة:آية"
  chapter: number;
  words: Word[];
};

export type PageData = { page: number; verses: Verse[] };

export type Chapter = {
  id: number;
  name: string;
  pages: [number, number];
  verses: number;
};

export type LineSlot =
  | { kind: 'words'; words: (Word & { verseKey: string; chapter: number })[] }
  | { kind: 'header'; chapter: number }
  | { kind: 'basmala' }
  | { kind: 'empty' };

export const TOTAL_PAGES = 604;
export const LINES_PER_PAGE = 15;
export const BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

// أول صفحة لكل جزء في المصحف المدني
const JUZ_STARTS = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302,
  322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export function juzOfPage(page: number): number {
  let juz = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    if (page >= JUZ_STARTS[i]) juz = i + 1;
  }
  return juz;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export function toArabicDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);
}

// يبني أسطر الصفحة الـ١٥ من الكلمات، ويحقن رؤوس السور والبسملة في الأسطر الفارغة
export function buildLines(data: PageData): LineSlot[] {
  const slots: LineSlot[] = Array.from({ length: LINES_PER_PAGE }, () => ({ kind: 'empty' }));

  for (const verse of data.verses) {
    for (const w of verse.words) {
      const idx = w.line - 1;
      if (idx < 0 || idx >= LINES_PER_PAGE) continue;
      let slot = slots[idx];
      if (slot.kind !== 'words') {
        slot = { kind: 'words', words: [] };
        slots[idx] = slot;
      }
      slot.words.push({ ...w, verseKey: verse.key, chapter: verse.chapter });
    }
  }

  // رؤوس السور: آية رقم ١ تبدأ كلمتها الأولى في هذه الصفحة
  for (const verse of data.verses) {
    const [, ayah] = verse.key.split(':');
    if (ayah !== '1') continue;
    const first = verse.words[0];
    if (!first || !first.id.endsWith(':1')) continue; // الآية مكملة من صفحة سابقة
    const firstLine = first.line;
    const hasBasmala = verse.chapter !== 1 && verse.chapter !== 9;
    const headerLine = firstLine - (hasBasmala ? 2 : 1);
    if (headerLine >= 1 && slots[headerLine - 1].kind === 'empty') {
      slots[headerLine - 1] = { kind: 'header', chapter: verse.chapter };
    }
    if (hasBasmala && firstLine - 1 >= 1 && slots[firstLine - 2].kind === 'empty') {
      slots[firstLine - 2] = { kind: 'basmala' };
    }
  }

  return slots;
}
