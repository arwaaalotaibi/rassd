// نموذج بيانات علامات الأخطاء وتخزينها محلياً (المرحلة ٥ تنقلها إلى Supabase)

export type ErrorType = 'khata' | 'taraddud' | 'tashkeel' | 'tajweed';

export const ERROR_TYPES: Record<
  ErrorType,
  { label: string; color: string; bg: string }
> = {
  khata: { label: 'خطأ', color: '#c0392b', bg: 'rgba(192, 57, 43, 0.18)' },
  taraddud: { label: 'تردّد', color: '#d68910', bg: 'rgba(214, 137, 16, 0.20)' },
  tashkeel: { label: 'تشكيل', color: '#2471a3', bg: 'rgba(36, 113, 163, 0.16)' },
  tajweed: { label: 'تجويد', color: '#7d3c98', bg: 'rgba(125, 60, 152, 0.15)' },
};

export type ErrorMark = {
  id: string;
  wordId: string; // "سورة:آية:موضع"
  page: number;
  type: ErrorType;
  date: string; // "YYYY-MM-DD" — تاريخ جلسة التسميع (أساس الطبقات)
  createdAt: number;
};

const STORAGE_PREFIX = 'rassd:errors:v1';

// التخزين المحلي معزول لكل هوية (صاحب الجهاز أو كل طالب على حدة)
function marksKey(identity: string): string {
  return `${STORAGE_PREFIX}:${identity}`;
}

// ترحيل التخزين القديم (قبل ملفات الطلاب) إلى مفتاح هوية صاحب الجهاز — مرة واحدة
export function migrateLegacyMarks(ownerIdentity: string) {
  const legacy = localStorage.getItem(STORAGE_PREFIX);
  if (legacy === null) return;
  if (localStorage.getItem(marksKey(ownerIdentity)) === null) {
    localStorage.setItem(marksKey(ownerIdentity), legacy);
  }
  localStorage.removeItem(STORAGE_PREFIX);
}

export function loadMarks(identity: string): ErrorMark[] {
  try {
    const raw = localStorage.getItem(marksKey(identity));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMarks(identity: string, marks: ErrorMark[]) {
  localStorage.setItem(marksKey(identity), JSON.stringify(marks));
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// علامة واحدة لكل كلمة في اليوم الواحد: الاختيار الجديد يستبدل القديم
export function upsertMark(
  marks: ErrorMark[],
  wordId: string,
  page: number,
  type: ErrorType,
  date: string
): ErrorMark[] {
  const rest = marks.filter((m) => !(m.wordId === wordId && m.date === date));
  return [
    ...rest,
    {
      id: `${wordId}@${date}`,
      wordId,
      page,
      type,
      date,
      createdAt: Date.now(),
    },
  ];
}

export function removeWordMarks(marks: ErrorMark[], wordId: string, date?: string): ErrorMark[] {
  return marks.filter((m) => !(m.wordId === wordId && (date === undefined || m.date === date)));
}

// ملخّص الطبقات: كل تاريخ جلسة وعدد كلماته (الأحدث أولاً)
export function datesSummary(marks: ErrorMark[]): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of marks) counts.set(m.date, (counts.get(m.date) ?? 0) + 1);
  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

// عدد + اسم معدود بصيغة عربية سليمة
export function arabicWordCount(n: number): string {
  const digits = (x: number) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  if (n === 0) return 'بلا كلمات';
  if (n === 1) return 'كلمة واحدة';
  if (n === 2) return 'كلمتان';
  if (n <= 10) return `${digits(n)} كلمات`;
  return `${digits(n)} كلمة`;
}

// تاريخ ميلادي بأرقام عربية (نفس أسلوب بقية التطبيقات)
export function formatArabicDate(iso: string): string {
  return new Intl.DateTimeFormat('ar-u-ca-gregory-nu-arab', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso + 'T00:00:00'));
}

// خريطة كلمة → علاماتها (مرتبة زمنياً) لصفحة معيّنة
export function marksByWord(marks: ErrorMark[], page: number): Map<string, ErrorMark[]> {
  const map = new Map<string, ErrorMark[]>();
  for (const m of marks) {
    if (m.page !== page) continue;
    const list = map.get(m.wordId) ?? [];
    list.push(m);
    map.set(m.wordId, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}
