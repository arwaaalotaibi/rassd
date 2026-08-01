'use client';

import { ERROR_TYPES, type ErrorMark } from '@/lib/errors';
import {
  BASMALA,
  TOTAL_PAGES,
  buildLines,
  juzOfPage,
  toArabicDigits,
  type Chapter,
  type PageData,
} from '@/lib/quran';
import { useMemo, type CSSProperties } from 'react';

type Props = {
  data: PageData;
  chapters: Map<number, Chapter>;
  marks?: Map<string, ErrorMark[]>;
  onWordClick?: (wordId: string, el: HTMLElement) => void;
  activeVerse?: string | null; // "سورة:آية" — الآية التي تُتلى الآن (مكرِّر الحفظ)
  similarVerses?: Set<string> | null; // آيات لها متشابهات — شارة ⚭ عند نهايتها
  onSimilarClick?: (verseKey: string) => void;
};

export default function MushafPage({
  data,
  chapters,
  marks,
  onWordClick,
  activeVerse,
  similarVerses,
  onSimilarClick,
}: Props) {
  const lines = useMemo(() => buildLines(data), [data]);
  const ornate = data.page <= 2; // الفاتحة وبداية البقرة بتنسيق مزخرف مُوسَّط
  const firstChapter = data.verses[0]?.chapter;
  const surahName = firstChapter ? chapters.get(firstChapter)?.name ?? '' : '';

  // وجه الصفحة في المصحف الورقي: الفردية يمين (كعبها يسار) والزوجية يسار (كعبها يمين)
  const isRight = data.page % 2 === 1;
  const side = isRight ? 'side-right' : 'side-left';
  // سماكة الأوراق على الحافة الخارجية — معلومة حقيقية لا زخرفة:
  // تحت الوجه الأيمن ما قرأتَه، وتحت الأيسر ما بقي (كالكتاب المفتوح تماماً)
  const frac = isRight
    ? (data.page - 1) / (TOTAL_PAGES - 1)
    : (TOTAL_PAGES - data.page) / (TOTAL_PAGES - 1);
  const stack = Math.round(2 + 10 * frac);

  return (
    <div
      className={`mushaf-frame w-full ${side}`}
      style={{ '--stack': `${stack}px` } as CSSProperties}
    >
      <div className="mushaf-frame-inner">
        <div className={`mushaf-page ${ornate ? 'ornate' : ''}`} style={{ aspectRatio: '0.68' }}>
          <div className="page-meta">
            <span>سورة {surahName}</span>
            <span
              className="page-spread"
              role="img"
              aria-label={isRight ? 'وجه أيمن' : 'وجه أيسر'}
              title={isRight ? 'هذه الصفحة وجه أيمن في المصحف' : 'هذه الصفحة وجه أيسر في المصحف'}
            >
              <i className={isRight ? 'on' : ''} />
              <i className={!isRight ? 'on' : ''} />
            </span>
            <span>الجزء {toArabicDigits(juzOfPage(data.page))}</span>
          </div>

          <div className="mushaf-lines">
            {lines.map((slot, i) => {
              if (slot.kind === 'empty') {
                return ornate ? null : <div key={i} className="mushaf-line" />;
              }
              if (slot.kind === 'header') {
                const name = chapters.get(slot.chapter)?.name ?? '';
                return (
                  <div key={i} className="surah-header">
                    <div className="surah-header-band">سُورَةُ {name}</div>
                  </div>
                );
              }
              if (slot.kind === 'basmala') {
                return (
                  <div key={i} className="mushaf-line basmala-line">
                    {BASMALA}
                  </div>
                );
              }
              // سطر كلمات — الأسطر القصيرة (أقل من ٤ كلمات) تُوسَّط بدل أن تتمدد
              const centered = ornate || slot.words.length < 4;
              return (
                <div key={i} className={`mushaf-line ${centered ? 'centered' : ''}`}>
                  {slot.words.map((w) => {
                    const reciting = activeVerse ? w.id.startsWith(activeVerse + ':') : false;
                    if (w.type === 'end') {
                      const verseKey = w.id.split(':').slice(0, 2).join(':');
                      const hasTwins = similarVerses?.has(verseKey) ?? false;
                      const endSpan = (
                        <span key={w.id} className={`ayah-end ${reciting ? 'reciting' : ''}`}>
                          {'۝' + toArabicDigits(w.text)}
                          {hasTwins && (
                            <button
                              className="similar-badge"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSimilarClick?.(verseKey);
                              }}
                              title="لهذه الآية متشابهات — انقر للمقارنة"
                              aria-label="عرض متشابهات الآية"
                            >
                              ⚭
                            </button>
                          )}
                        </span>
                      );
                      return endSpan;
                    }
                    const wordMarks = marks?.get(w.id);
                    const last = wordMarks?.[wordMarks.length - 1];
                    const t = last ? ERROR_TYPES[last.type] : null;
                    const hasNote = wordMarks?.some((m) => m.note) ?? false;
                    return (
                      <span
                        key={w.id}
                        className={`word ${t ? 'marked' : ''} ${reciting ? 'reciting' : ''} ${hasNote ? 'has-note' : ''}`}
                        style={
                          t
                            ? ({ '--mark-color': t.color, '--mark-bg': t.bg } as CSSProperties)
                            : undefined
                        }
                        onClick={(e) => onWordClick?.(w.id, e.currentTarget)}
                      >
                        {w.text}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* وجه الصفحة في المصحف الورقي: الفردية يمين والزوجية يسار (الفاتحة ص١ = يمين) */}
          <div className="page-number">
            <span>
              {toArabicDigits(data.page)}
              <em className="page-side">· {data.page % 2 === 1 ? 'وجه أيمن' : 'وجه أيسر'}</em>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
