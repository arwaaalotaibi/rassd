'use client';

import MushafPage from '@/components/MushafPage';
import {
  ERROR_TYPES,
  loadMarks,
  marksByWord,
  removeWordMarks,
  saveMarks,
  todayISO,
  upsertMark,
  type ErrorMark,
  type ErrorType,
} from '@/lib/errors';
import {
  TOTAL_PAGES,
  toArabicDigits,
  type Chapter,
  type PageData,
} from '@/lib/quran';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const pageCache = new Map<number, PageData>();

async function fetchPage(p: number): Promise<PageData> {
  const cached = pageCache.get(p);
  if (cached) return cached;
  const res = await fetch(`/quran/pages/${p}.json`);
  const data: PageData = await res.json();
  pageCache.set(p, data);
  return data;
}

type Popover = { wordId: string; x: number; y: number };

export default function Home() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [pageInput, setPageInput] = useState('');
  const [marks, setMarks] = useState<ErrorMark[]>([]);
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [popover, setPopover] = useState<Popover | null>(null);
  const loadSeq = useRef(0);
  const pageWrapRef = useRef<HTMLDivElement>(null);

  const chapterMap = useMemo(
    () => new Map(chapters.map((c) => [c.id, c])),
    [chapters]
  );

  const pageMarks = useMemo(() => marksByWord(marks, page), [marks, page]);
  const pageErrorCount = useMemo(() => pageMarks.size, [pageMarks]);

  // استرجاع آخر صفحة + العلامات + تحميل أسماء السور
  useEffect(() => {
    const saved = Number(localStorage.getItem('rassd:page'));
    if (saved >= 1 && saved <= TOTAL_PAGES) setPage(saved);
    setMarks(loadMarks());
    fetch('/quran/chapters.json')
      .then((r) => r.json())
      .then(setChapters);
  }, []);

  // تحميل الصفحة الحالية + جلب مسبق للمجاورتين
  useEffect(() => {
    const seq = ++loadSeq.current;
    setPopover(null);
    fetchPage(page).then((d) => {
      if (loadSeq.current === seq) setData(d);
    });
    if (page < TOTAL_PAGES) fetchPage(page + 1);
    if (page > 1) fetchPage(page - 1);
    localStorage.setItem('rassd:page', String(page));
  }, [page]);

  const go = useCallback((p: number) => {
    if (p >= 1 && p <= TOTAL_PAGES) setPage(p);
  }, []);

  // أسهم الكيبورد: اليسار = الصفحة التالية (اتجاه المصحف)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') go(page + 1);
      if (e.key === 'ArrowRight') go(page - 1);
      if (e.key === 'Escape') setPopover(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, go]);

  const updateMarks = useCallback((next: ErrorMark[]) => {
    setMarks(next);
    saveMarks(next);
  }, []);

  const onWordClick = useCallback((wordId: string, el: HTMLElement) => {
    const wrap = pageWrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - wrapRect.left;
    const y = rect.bottom - wrapRect.top + 6;
    setPopover((prev) => (prev?.wordId === wordId ? null : { wordId, x, y }));
  }, []);

  const currentChapter = data?.verses[0]?.chapter ?? 1;
  const popoverMarks = popover ? pageMarks.get(popover.wordId) ?? [] : [];
  const sessionMark = popoverMarks.find((m) => m.date === sessionDate);

  const submitPageInput = () => {
    // تطبيع الأرقام العربية قبل التحقق
    const normalized = pageInput.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const n = Number(normalized);
    if (Number.isInteger(n) && n >= 1 && n <= TOTAL_PAGES) go(n);
    setPageInput('');
  };

  return (
    <main className="flex-1 flex flex-col items-center gap-5 px-4 py-6">
      {/* الترويسة */}
      <header className="w-full max-w-xl flex items-center justify-between">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--green-deep)' }}>
          📖 رصد
        </h1>
        <p className="text-sm font-semibold opacity-70">
          مصحف إلكتروني — رواية حفص عن عاصم
        </p>
      </header>

      {/* أدوات التنقل */}
      <div className="controls w-full max-w-xl flex flex-wrap items-center gap-2 justify-center">
        <select
          value={currentChapter}
          onChange={(e) => {
            const c = chapterMap.get(Number(e.target.value));
            if (c) go(c.pages[0]);
          }}
          className="flex-1 min-w-36"
          aria-label="اختيار السورة"
        >
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {toArabicDigits(c.id)}. {c.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          inputMode="numeric"
          placeholder={`صفحة ١-${toArabicDigits(TOTAL_PAGES)}`}
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitPageInput()}
          onBlur={() => pageInput && submitPageInput()}
          className="w-28 text-center"
          aria-label="الانتقال إلى صفحة"
        />

        <div className="flex gap-2">
          <button className="nav-btn" onClick={() => go(page - 1)} disabled={page <= 1}>
            ▶ السابقة
          </button>
          <button className="nav-btn" onClick={() => go(page + 1)} disabled={page >= TOTAL_PAGES}>
            التالية ◀
          </button>
        </div>
      </div>

      {/* شريط جلسة التسميع: التاريخ + دليل الألوان + عدّاد */}
      <div className="controls session-bar w-full max-w-xl">
        <label className="session-date">
          📅 تاريخ الجلسة
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => e.target.value && setSessionDate(e.target.value)}
          />
        </label>
        <div className="legend">
          {(Object.keys(ERROR_TYPES) as ErrorType[]).map((k) => (
            <span
              key={k}
              className="legend-chip"
              style={{ background: ERROR_TYPES[k].bg, borderColor: ERROR_TYPES[k].color }}
            >
              {ERROR_TYPES[k].label}
            </span>
          ))}
        </div>
        <span className="error-count">
          كلمات مرصودة في الصفحة: {toArabicDigits(pageErrorCount)}
        </span>
      </div>

      {/* صفحة المصحف */}
      <div className="w-full max-w-xl relative" ref={pageWrapRef}>
        {data && chapters.length > 0 ? (
          <MushafPage
            data={data}
            chapters={chapterMap}
            marks={pageMarks}
            onWordClick={onWordClick}
          />
        ) : (
          <div
            className="mushaf-frame w-full animate-pulse"
            style={{ aspectRatio: '0.68' }}
          />
        )}

        {/* نافذة اختيار نوع الخطأ */}
        {popover && (
          <>
            <div className="popover-backdrop" onClick={() => setPopover(null)} />
            <div
              className="error-popover"
              style={{
                left: `clamp(8px, calc(${popover.x}px - 105px), calc(100% - 218px))`,
                top: popover.y,
              }}
            >
              <div className="popover-title">
                {sessionMark ? 'تعديل الرصد' : 'رصد خطأ'} — جلسة {toArabicDigits(sessionDate)}
              </div>
              <div className="types">
                {(Object.keys(ERROR_TYPES) as ErrorType[]).map((k) => (
                  <button
                    key={k}
                    className={`type-btn ${sessionMark?.type === k ? 'active' : ''}`}
                    style={{ background: ERROR_TYPES[k].bg, color: ERROR_TYPES[k].color }}
                    onClick={() => {
                      updateMarks(upsertMark(marks, popover.wordId, page, k, sessionDate));
                      setPopover(null);
                    }}
                  >
                    {ERROR_TYPES[k].label}
                  </button>
                ))}
              </div>
              {popoverMarks.length > 0 && (
                <button
                  className="remove-btn"
                  onClick={() => {
                    updateMarks(removeWordMarks(marks, popover.wordId));
                    setPopover(null);
                  }}
                >
                  🗑 إزالة الرصد عن الكلمة
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="text-xs opacity-60 font-semibold pb-2">
        النص القرآني وفق مصحف المدينة النبوية — مجمع الملك فهد لطباعة المصحف الشريف
      </footer>
    </main>
  );
}
