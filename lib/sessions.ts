// سجلّ جلسات التسميع: النطاق المسمَّع (سورة + آيات) والتقييم العام

export type SessionRating = 'excellent' | 'good' | 'redo';

export const RATINGS: Record<
  SessionRating,
  { label: string; emoji: string; color: string; bg: string }
> = {
  excellent: { label: 'ممتاز', emoji: '🌟', color: '#14614a', bg: 'rgba(20, 97, 74, 0.12)' },
  good: { label: 'جيد', emoji: '👍', color: '#b8912f', bg: 'rgba(184, 145, 47, 0.14)' },
  redo: { label: 'يحتاج إعادة', emoji: '🔁', color: '#c0392b', bg: 'rgba(192, 57, 43, 0.1)' },
};

export type SessionLog = {
  id: string;
  date: string; // YYYY-MM-DD
  surah: number;
  fromAyah: number;
  toAyah: number;
  rating: SessionRating;
  createdAt: number;
};

const PREFIX = 'rassd:sessions:v1';

export function loadLogs(identity: string): SessionLog[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${PREFIX}:${identity}`) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLogs(identity: string, logs: SessionLog[]) {
  localStorage.setItem(`${PREFIX}:${identity}`, JSON.stringify(logs));
}

export function mergeLogs(a: SessionLog[], b: SessionLog[]): SessionLog[] {
  const map = new Map<string, SessionLog>();
  for (const l of [...a, ...b]) {
    const prev = map.get(l.id);
    if (!prev || l.createdAt >= prev.createdAt) map.set(l.id, l);
  }
  return [...map.values()].sort(
    (x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt
  );
}
