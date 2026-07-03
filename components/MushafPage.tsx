'use client';

import { ERROR_TYPES, type ErrorMark } from '@/lib/errors';
import {
  BASMALA,
  LAYOUTS,
  buildLines,
  juzOfPage,
  toArabicDigits,
  type Chapter,
  type LayoutId,
  type PageData,
} from '@/lib/quran';
import { useMemo, type CSSProperties } from 'react';

type Props = {
  data: PageData;
  chapters: Map<number, Chapter>;
  marks?: Map<string, ErrorMark[]>;
  onWordClick?: (wordId: string, el: HTMLElement) => void;
  activeVerse?: string | null; // "سورة:آية" — الآية التي تُتلى الآن (مكرِّر الحفظ)
  layout?: LayoutId;
};

export default function MushafPage({
  data,
  chapters,
  marks,
  onWordClick,
  activeVerse,
  layout = 'madani',
}: Props) {
  const layoutCfg = LAYOUTS[layout];
  const lines = useMemo(() => buildLines(data, layoutCfg.lines), [data, layoutCfg.lines]);
  const ornate = data.page <= 2; // الفاتحة وبداية البقرة بتنسيق مزخرف مُوسَّط
  const firstChapter = data.verses[0]?.chapter;
  const surahName = firstChapter ? chapters.get(firstChapter)?.name ?? '' : '';
  const juz = data.juz ?? (layout === 'madani' ? juzOfPage(data.page) : null);

  return (
    <div className="mushaf-frame w-full">
      <div className="mushaf-frame-inner">
        <div
          className={`mushaf-page ${ornate ? 'ornate' : ''} ${layoutCfg.font === 'indopak' ? 'indopak' : ''}`}
          style={{ aspectRatio: '0.68' }}
        >
          <div className="page-meta">
            <span>سورة {surahName}</span>
            <span>{juz ? `الجزء ${toArabicDigits(juz)}` : LAYOUTS[layout].short}</span>
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
                      return (
                        <span key={w.id} className={`ayah-end ${reciting ? 'reciting' : ''}`}>
                          {'۝' + toArabicDigits(w.text)}
                        </span>
                      );
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

          <div className="page-number">
            <span>{toArabicDigits(data.page)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
