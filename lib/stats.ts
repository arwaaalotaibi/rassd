// حساب إحصاءات الرصد للهوية النشطة — كله محلي في المتصفح
import type { ErrorMark, ErrorType } from './errors';

export type Stats = {
  sessionsCount: number;
  totalWords: number; // كلمات فريدة مرصودة
  pagesCount: number; // صفحات فيها رصد
  repeatedWords: number; // كلمات تكرّر خطؤها في جلستين أو أكثر
  sessions: { date: string; count: number }[]; // تصاعدياً بالتاريخ
  types: Record<ErrorType, number>;
  topPages: { page: number; count: number }[];
};

export function computeStats(marks: ErrorMark[]): Stats {
  const sessions = new Map<string, number>();
  const types: Record<ErrorType, number> = {
    khata: 0,
    taraddud: 0,
    tashkeel: 0,
    tajweed: 0,
    similar: 0,
  };
  const pages = new Map<number, number>();
  const wordDates = new Map<string, Set<string>>();

  for (const m of marks) {
    sessions.set(m.date, (sessions.get(m.date) ?? 0) + 1);
    types[m.type] += 1;
    pages.set(m.page, (pages.get(m.page) ?? 0) + 1);
    const dates = wordDates.get(m.wordId) ?? new Set<string>();
    dates.add(m.date);
    wordDates.set(m.wordId, dates);
  }

  let repeatedWords = 0;
  for (const dates of wordDates.values()) {
    if (dates.size >= 2) repeatedWords += 1;
  }

  return {
    sessionsCount: sessions.size,
    totalWords: wordDates.size,
    pagesCount: pages.size,
    repeatedWords,
    sessions: [...sessions.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    types,
    topPages: [...pages.entries()]
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}
