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

const STORAGE_KEY = 'rassd:errors:v1';

export function loadMarks(): ErrorMark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMarks(marks: ErrorMark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
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
