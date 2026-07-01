'use client';

import {
  BASMALA,
  buildLines,
  juzOfPage,
  toArabicDigits,
  type Chapter,
  type PageData,
} from '@/lib/quran';
import { useMemo } from 'react';

type Props = {
  data: PageData;
  chapters: Map<number, Chapter>;
};

export default function MushafPage({ data, chapters }: Props) {
  const lines = useMemo(() => buildLines(data), [data]);
  const ornate = data.page <= 2; // الفاتحة وبداية البقرة بتنسيق مزخرف مُوسَّط
  const firstChapter = data.verses[0]?.chapter;
  const surahName = firstChapter ? chapters.get(firstChapter)?.name ?? '' : '';

  return (
    <div className="mushaf-frame w-full">
      <div className="mushaf-frame-inner">
        <div className={`mushaf-page ${ornate ? 'ornate' : ''}`} style={{ aspectRatio: '0.68' }}>
          <div className="page-meta">
            <span>سورة {surahName}</span>
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
                  {slot.words.map((w) =>
                    w.type === 'end' ? (
                      <span key={w.id} className="ayah-end">
                        {'۝' + toArabicDigits(w.text)}
                      </span>
                    ) : (
                      <span key={w.id} className="word" data-word-id={w.id}>
                        {w.text}
                      </span>
                    )
                  )}
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
