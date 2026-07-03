'use client';

// صفحة المشرفة: إحصاءات مجمّعة + إعلان عام + حذف بيانات مستخدم
// البوابة الحقيقية في قاعدة البيانات (الدوال ترجع null لغير المشرفة)

import { toArabicDigits, type Chapter } from '@/lib/quran';
import { getSupabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

type FeedbackItem = {
  id: number;
  message: string;
  contact: string;
  device_id: string;
  at: string;
};

type AdminStats = {
  identities: number;
  accounts: number;
  teachers: number;
  links: number;
  marks: number;
  logs: number;
  active7: number;
  active30: number;
  weekly: { week: string; users: number; marks: number }[];
  top_surahs: { surah: number; c: number }[];
  top_pages: { page: number; c: number }[];
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Map<number, string>>(new Map());
  const [announce, setAnnounce] = useState('');
  const [announceMsg, setAnnounceMsg] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');
  const [inbox, setInbox] = useState<FeedbackItem[]>([]);

  const loadInbox = () => {
    getSupabase()
      ?.rpc('admin_feedback')
      .then(({ data }) => {
        if (Array.isArray(data)) setInbox(data as FeedbackItem[]);
      });
  };

  useEffect(() => {
    fetch('/quran/chapters.json')
      .then((r) => r.json())
      .then((list: Chapter[]) => setChapters(new Map(list.map((c) => [c.id, c.name]))));
    const sb = getSupabase();
    if (!sb) {
      setDenied(true);
      setLoading(false);
      return;
    }
    sb.rpc('admin_stats').then(({ data, error }) => {
      setLoading(false);
      if (error || data === null) {
        setDenied(true);
        return;
      }
      setStats(data as AdminStats);
      loadInbox();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.rpc('admin_set_announcement', { msg: announce });
    setAnnounceMsg(
      data
        ? announce.trim()
          ? '✅ نُشر الإعلان لجميع المستخدمين'
          : '✅ أُزيل الإعلان الحالي'
        : '⚠️ غير مصرّح'
    );
  };

  const doDelete = async () => {
    const sb = getSupabase();
    if (!sb) return;
    const target = deleteId.trim().toLowerCase();
    if (!/^[0-9a-f-]{36}$/.test(target)) {
      setDeleteMsg('⚠️ رمز غير صحيح');
      return;
    }
    if (!confirm(`حذف نهائي لكل بيانات ${target.slice(0, 8)}…؟ لا رجعة بعدها.`)) return;
    const { data } = await sb.rpc('admin_delete_user_data', { target });
    if (!data) {
      setDeleteMsg('⚠️ غير مصرّح');
      return;
    }
    const d = data as { marks: number; logs: number; links: number };
    setDeleteMsg(
      `✅ حُذف: ${toArabicDigits(d.marks)} علامة، ${toArabicDigits(d.logs)} سجل جلسة، ${toArabicDigits(d.links)} رابط`
    );
    setDeleteId('');
  };

  if (loading) {
    return (
      <main className="admin-root">
        <p className="admin-note">⏳ يتحقق…</p>
      </main>
    );
  }

  if (denied || !stats) {
    return (
      <main className="admin-root">
        <p className="admin-note">
          هذه الصفحة للمشرفة فقط — سجّلي الدخول بحساب المشرفة من{' '}
          <a href="/" className="admin-link">
            الصفحة الرئيسية
          </a>{' '}
          ثم عودي.
        </p>
      </main>
    );
  }

  const maxWeekly = Math.max(1, ...stats.weekly.map((w) => w.marks));

  return (
    <main className="admin-root controls">
      <header className="admin-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="brand-logo" />
        <h1>لوحة المشرفة</h1>
        <a href="/" className="admin-link">
          ← للمصحف
        </a>
      </header>

      {/* نبض التطبيق */}
      <section className="admin-card">
        <h2>📈 نبض التطبيق</h2>
        <div className="stats-cards admin-grid">
          <div className="stat-card">
            <b>{toArabicDigits(stats.identities)}</b>
            <span>مستخدم (هويات)</span>
          </div>
          <div className="stat-card">
            <b>{toArabicDigits(stats.accounts)}</b>
            <span>حساب مسجَّل</span>
          </div>
          <div className="stat-card">
            <b>{toArabicDigits(stats.active7)}</b>
            <span>نشِط آخر ٧ أيام</span>
          </div>
          <div className="stat-card">
            <b>{toArabicDigits(stats.active30)}</b>
            <span>نشِط آخر ٣٠ يوماً</span>
          </div>
          <div className="stat-card">
            <b>{toArabicDigits(stats.teachers)}</b>
            <span>معلّمات</span>
          </div>
          <div className="stat-card">
            <b>{toArabicDigits(stats.links)}</b>
            <span>روابط معلّم-طالب</span>
          </div>
          <div className="stat-card">
            <b>{toArabicDigits(stats.marks)}</b>
            <span>علامة مرصودة</span>
          </div>
          <div className="stat-card">
            <b>{toArabicDigits(stats.logs)}</b>
            <span>سجل جلسة</span>
          </div>
        </div>
      </section>

      {/* النمو الأسبوعي */}
      <section className="admin-card">
        <h2>📅 النشاط الأسبوعي (أحدث ٨ أسابيع)</h2>
        {stats.weekly.length === 0 ? (
          <p className="admin-note">لا نشاط بعد</p>
        ) : (
          <div className="admin-weeks">
            {stats.weekly.map((w) => (
              <div key={w.week} className="admin-week-row">
                <span className="admin-week-label">أسبوع {toArabicDigits(w.week)}</span>
                <div className="type-bar-track">
                  <div
                    className="type-bar-fill"
                    style={{
                      width: `${Math.round((w.marks / maxWeekly) * 100)}%`,
                      background: 'var(--green)',
                    }}
                  />
                </div>
                <span className="admin-week-nums">
                  {toArabicDigits(w.marks)} علامة · {toArabicDigits(w.users)} مستخدم
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* الاتجاهات */}
      <section className="admin-card">
        <h2>📊 أين يخطئ الحفّاظ أكثر؟ (مجمّع ومجهول)</h2>
        <div className="admin-trends">
          <div>
            <h3>أكثر السور</h3>
            {stats.top_surahs.map((t) => (
              <p key={t.surah} className="admin-trend-row">
                <span>{chapters.get(t.surah) ?? t.surah}</span>
                <b>{toArabicDigits(t.c)}</b>
              </p>
            ))}
          </div>
          <div>
            <h3>أكثر الصفحات</h3>
            {stats.top_pages.map((t) => (
              <p key={t.page} className="admin-trend-row">
                <span>صفحة {toArabicDigits(t.page)}</span>
                <b>{toArabicDigits(t.c)}</b>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* الملاحظات الواردة */}
      <section className="admin-card">
        <h2>📮 ملاحظات المستخدمين ({toArabicDigits(inbox.length)})</h2>
        {inbox.length === 0 ? (
          <p className="admin-note">لا ملاحظات بعد — أول ما يرسل أحد تظهر هنا.</p>
        ) : (
          <div className="admin-inbox">
            {inbox.map((f) => (
              <div key={f.id} className="feedback-item">
                <p className="feedback-message">{f.message}</p>
                <div className="feedback-meta">
                  <span>🗓 {toArabicDigits(f.at)}</span>
                  {f.contact && <span dir="ltr">📞 {f.contact}</span>}
                  <span dir="ltr" className="feedback-sender">
                    {f.device_id.slice(0, 8)}…
                  </span>
                  <button
                    className="student-remove"
                    title="حذف الملاحظة"
                    onClick={async () => {
                      await getSupabase()?.rpc('admin_delete_feedback', { fid: f.id });
                      loadInbox();
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* الإعلان العام */}
      <section className="admin-card">
        <h2>📢 إعلان لجميع المستخدمين</h2>
        <p className="admin-note">
          يظهر شريطاً أعلى التطبيق للجميع. اتركيه فارغاً واضغطي «نشر» لإزالة
          الإعلان الحالي.
        </p>
        <textarea
          className="note-input"
          rows={2}
          placeholder="مثال: جديد! 🎧 ميزة الاستماع والتكرار للحفظ — جرّبوها"
          value={announce}
          onChange={(e) => setAnnounce(e.target.value)}
        />
        {announceMsg && <p className="admin-note">{announceMsg}</p>}
        <button className="nav-btn" onClick={publish}>
          📢 نشر
        </button>
      </section>

      {/* حذف بيانات مستخدم */}
      <section className="admin-card danger">
        <h2>🗑️ حذف بيانات مستخدم (نهائي)</h2>
        <p className="admin-note">
          لطلبات «احذفوا بياناتي»: الصقي رمز المستخدم وسيُحذف كل ما يخصه (علامات،
          سجلات، روابط).
        </p>
        <input
          type="text"
          dir="ltr"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={deleteId}
          onChange={(e) => setDeleteId(e.target.value)}
        />
        {deleteMsg && <p className="admin-note">{deleteMsg}</p>}
        <button className="nav-btn stop-btn" disabled={!deleteId.trim()} onClick={doDelete}>
          حذف نهائي
        </button>
      </section>
    </main>
  );
}
