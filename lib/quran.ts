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

export type PageData = { page: number; juz?: number | null; verses: Verse[] };

// ————— مخططات المصاحف —————
export type LayoutId = 'madani' | 'indopak15' | 'indopak16';

export type MushafLayout = {
  id: LayoutId;
  name: string;
  short: string;
  totalPages: number;
  lines: number;
  dir: string; // مجلد الصفحات داخل public/quran
  font: 'uthmani' | 'indopak';
  // بصمة التمييز: أول كلمات الصفحة ٣٠٠ في المصحف الورقي
  sampleWords: string;
  sampleRef: string;
};

export const LAYOUTS: Record<LayoutId, MushafLayout> = {
  madani: {
    id: 'madani',
    name: 'مصحف المدينة النبوية',
    short: 'المدينة',
    totalPages: 604,
    lines: 15,
    dir: 'pages',
    font: 'uthmani',
    sampleWords: 'وَلَقَدۡ صَرَّفۡنَا فِي هَٰذَا',
    sampleRef: 'الكهف ٥٤',
  },
  indopak15: {
    id: 'indopak15',
    name: 'المصحف الباكستاني — ١٥ سطراً',
    short: 'باكستاني ١٥',
    totalPages: 610,
    lines: 15,
    dir: 'indopak15',
    font: 'indopak',
    sampleWords: 'وَمَا مَنَعَ النَّاسَ اَنۡ',
    sampleRef: 'الكهف ٥٥',
  },
  indopak16: {
    id: 'indopak16',
    name: 'المصحف الباكستاني — ١٦ سطراً',
    short: 'باكستاني ١٦',
    totalPages: 548,
    lines: 16,
    dir: 'indopak16',
    font: 'indopak',
    sampleWords: 'ذٰلِكَ بِاَنَّ اللّٰهَ هُوَ',
    sampleRef: 'الحج ٦',
  },
};

export const DEFAULT_LAYOUT: LayoutId = 'madani';

export function loadLayout(): LayoutId {
  const saved = localStorage.getItem('rassd:layout');
  return saved && saved in LAYOUTS ? (saved as LayoutId) : DEFAULT_LAYOUT;
}

export function saveLayout(id: LayoutId) {
  localStorage.setItem('rassd:layout', id);
}

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

// يبني أسطر الصفحة من الكلمات، ويحقن رؤوس السور والبسملة في الأسطر الفارغة
export function buildLines(data: PageData, linesPerPage: number = LINES_PER_PAGE): LineSlot[] {
  const slots: LineSlot[] = Array.from({ length: linesPerPage }, () => ({ kind: 'empty' }));

  for (const verse of data.verses) {
    for (const w of verse.words) {
      const idx = w.line - 1;
      if (idx < 0 || idx >= linesPerPage) continue;
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
