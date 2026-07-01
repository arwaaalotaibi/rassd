'use client';

import MushafPage from '@/components/MushafPage';
import {
  ERROR_TYPES,
  arabicWordCount,
  datesSummary,
  formatArabicDate,
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
  const [hiddenDates, setHiddenDates] = useState<Set<string>>(new Set());
  const [layersOpen, setLayersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportErr, setExportErr] = useState('');
  const [printData, setPrintData] = useState<PageData[] | null>(null);
  const loadSeq = useRef(0);
  const pageWrapRef = useRef<HTMLDivElement>(null);

  const chapterMap = useMemo(
    () => new Map(chapters.map((c) => [c.id, c])),
    [chapters]
  );

  // الطبقات: العلامات المعروضة = تواريخ غير مخفيّة فقط
  const layers = useMemo(() => datesSummary(marks), [marks]);
  const visibleMarks = useMemo(
    () => marks.filter((m) => !hiddenDates.has(m.date)),
    [marks, hiddenDates]
  );
  const pageMarks = useMemo(() => marksByWord(visibleMarks, page), [visibleMarks, page]);
  const pageErrorCount = useMemo(() => pageMarks.size, [pageMarks]);

  // استرجاع آخر صفحة + العلامات + الطبقات المخفية + تحميل أسماء السور
  useEffect(() => {
    const saved = Number(localStorage.getItem('rassd:page'));
    if (saved >= 1 && saved <= TOTAL_PAGES) setPage(saved);
    setMarks(loadMarks());
    try {
      const hidden = JSON.parse(localStorage.getItem('rassd:hiddenDates') ?? '[]');
      if (Array.isArray(hidden)) setHiddenDates(new Set(hidden));
    } catch {}
    fetch('/quran/chapters.json')
      .then((r) => r.json())
      .then(setChapters);
  }, []);

  const updateHiddenDates = useCallback((next: Set<string>) => {
    setHiddenDates(next);
    localStorage.setItem('rassd:hiddenDates', JSON.stringify([...next]));
  }, []);

  const toggleLayer = useCallback(
    (date: string) => {
      const next = new Set(hiddenDates);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      updateHiddenDates(next);
    },
    [hiddenDates, updateHiddenDates]
  );

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

  // تصدير PDF: جلب صفحات النطاق ثم فتح نافذة الطباعة بعد جاهزية الخط
  const MAX_EXPORT_PAGES = 50;

  const normalizeDigits = (s: string) =>
    s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  const doExport = async () => {
    const from = exportFrom ? Number(normalizeDigits(exportFrom)) : page;
    const to = exportTo ? Number(normalizeDigits(exportTo)) : from;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > TOTAL_PAGES) {
      setExportErr(`أدخلي أرقام صفحات بين ١ و${toArabicDigits(TOTAL_PAGES)}`);
      return;
    }
    if (to < from) {
      setExportErr('صفحة النهاية قبل صفحة البداية');
      return;
    }
    if (to - from + 1 > MAX_EXPORT_PAGES) {
      setExportErr(`الحد الأقصى ${toArabicDigits(MAX_EXPORT_PAGES)} صفحة في التصدير الواحد`);
      return;
    }
    setExportErr('');
    const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const datas = await Promise.all(nums.map(fetchPage));
    setExportOpen(false);
    setPrintData(datas);
  };

  useEffect(() => {
    if (!printData) return;
    let cancelled = false;
    // ننتظر تحميل خط المصحف واكتمال الرسم قبل فتح الطباعة حتى لا تخرج الصفحات فارغة أو بخط بديل
    document.fonts.ready.then(() => {
      if (cancelled) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setTimeout(() => {
            if (cancelled) return;
            window.print();
            setPrintData(null);
          }, 120)
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [printData]);

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
    <main className="app-root flex-1 flex flex-col items-center gap-5 px-4 py-6">
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
          <button
            className="nav-btn export-btn"
            onClick={() => {
              setExportFrom(String(page));
              setExportTo(String(page));
              setExportErr('');
              setExportOpen(true);
            }}
          >
            📄 تصدير PDF
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

      {/* لوحة الطبقات — كل تاريخ جلسة طبقة مستقلة */}
      <div className="layers-panel w-full max-w-xl">
        <button className="layers-header" onClick={() => setLayersOpen(!layersOpen)}>
          <span>
            🗓️ جلسات التسميع{' '}
            {layers.length > 0 && (
              <span className="layers-count">{toArabicDigits(layers.length)}</span>
            )}
          </span>
          <span className="layers-chevron">{layersOpen ? '▲' : '▼'}</span>
        </button>

        {layersOpen && (
          <div className="layers-body">
            {layers.length === 0 ? (
              <p className="layers-empty">
                لا توجد جلسات بعد — ارصدي أول خطأ وستظهر جلسة اليوم هنا،
                وتقدرين تخفين أخطاء أي جلسة أو تظهرينها متى شئتِ.
              </p>
            ) : (
              <>
                <div className="layers-actions">
                  <button onClick={() => updateHiddenDates(new Set())}>👁 إظهار الكل</button>
                  <button
                    onClick={() => updateHiddenDates(new Set(layers.map((l) => l.date)))}
                  >
                    🚫 إخفاء الكل
                  </button>
                </div>
                {layers.map((l) => {
                  const hidden = hiddenDates.has(l.date);
                  return (
                    <button
                      key={l.date}
                      className={`layer-row ${hidden ? 'hidden-layer' : ''}`}
                      onClick={() => toggleLayer(l.date)}
                      title={hidden ? 'إظهار أخطاء هذه الجلسة' : 'إخفاء أخطاء هذه الجلسة'}
                    >
                      <span className="layer-eye">{hidden ? '◡' : '👁'}</span>
                      <span className="layer-date">
                        {formatArabicDate(l.date)}
                        {l.date === sessionDate && <em> — الجلسة الحالية</em>}
                      </span>
                      <span className="layer-count">{arabicWordCount(l.count)}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}
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
                      // رصد على طبقة مخفيّة يُظهرها تلقائياً حتى لا يختفي الرصد الجديد
                      if (hiddenDates.has(sessionDate)) {
                        const next = new Set(hiddenDates);
                        next.delete(sessionDate);
                        updateHiddenDates(next);
                      }
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

      {/* نافذة تصدير PDF */}
      {exportOpen && (
        <div className="export-backdrop" onClick={() => setExportOpen(false)}>
          <div className="export-dialog controls" onClick={(e) => e.stopPropagation()}>
            <h2>📄 تصدير PDF</h2>
            <p className="export-hint">
              يُصدَّر المصحف بالأخطاء الظاهرة حالياً حسب الجلسات المفعّلة في «جلسات
              التسميع». اتركي الحقلين كما هما لتصدير الصفحة الحالية فقط.
            </p>
            <div className="export-range">
              <label>
                من صفحة
                <input
                  type="text"
                  inputMode="numeric"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                />
              </label>
              <label>
                إلى صفحة
                <input
                  type="text"
                  inputMode="numeric"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                />
              </label>
            </div>
            {exportErr && <p className="export-error">⚠️ {exportErr}</p>}
            <div className="export-actions">
              <button className="nav-btn" onClick={doExport}>
                🖨️ طباعة / حفظ PDF
              </button>
              <button className="cancel-btn" onClick={() => setExportOpen(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* حاوية الطباعة — تظهر فقط في نافذة الطباعة */}
      {printData && (
        <div className="print-root">
          {printData.map((d) => (
            <div key={d.page} className="print-page">
              <div className="print-head">
                <span>📖 رصد — متابعة أخطاء التسميع</span>
                <span>{formatArabicDate(todayISO())}</span>
              </div>
              <div className="print-legend">
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
              <MushafPage
                data={d}
                chapters={chapterMap}
                marks={marksByWord(visibleMarks, d.page)}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
