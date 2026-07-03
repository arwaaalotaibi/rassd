'use client';

import MushafPage from '@/components/MushafPage';
import {
  ERROR_TYPES,
  arabicWordCount,
  datesSummary,
  formatArabicDate,
  loadMarks,
  marksByWord,
  migrateLegacyMarks,
  removeWordMarks,
  saveMarks,
  todayISO,
  upsertMark,
  type ErrorMark,
  type ErrorType,
} from '@/lib/errors';
import {
  UUID_RE,
  loadActiveStudent,
  loadStudents,
  saveActiveStudent,
  saveStudents,
  type StudentProfile,
} from '@/lib/profiles';
import { DEFAULT_RECITER, RECITERS, ayahAudioUrl, loadReciter, saveReciter } from '@/lib/reciters';
import { computeStats } from '@/lib/stats';
import {
  LAYOUTS,
  loadLayout,
  saveLayout,
  toArabicDigits,
  type Chapter,
  type LayoutId,
  type PageData,
} from '@/lib/quran';
import {
  addTeacherLink,
  adoptSyncCode,
  deleteRemoteMarks,
  fetchMarksByCode,
  fetchMyLinkedStudents,
  fetchMyTeachers,
  fetchRemoteMarks,
  getDeviceId,
  getSessionUser,
  getSupabase,
  pushMarks,
  removeTeacherLink,
  setIdentity,
  sendEmailOtp,
  signInWithGoogle,
  signOutAccount,
  verifyEmailOtp,
  type TeacherLink,
} from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const pageCache = new Map<string, PageData>();

async function fetchLayoutPage(dir: string, p: number): Promise<PageData> {
  const key = `${dir}:${p}`;
  const cached = pageCache.get(key);
  if (cached) return cached;
  const res = await fetch(`/quran/${dir}/${p}.json`);
  const data: PageData = await res.json();
  pageCache.set(key, data);
  return data;
}

type Popover = { wordId: string; x: number; y: number };

type ListEntry =
  | { kind: 'date'; date: string; count: number }
  | { kind: 'mark'; m: ErrorMark };

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
  const [exportBusy, setExportBusy] = useState('');
  const [printData, setPrintData] = useState<PageData[] | null>(null);
  const [syncState, setSyncState] = useState<'off' | 'syncing' | 'ok' | 'error'>('off');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [activeStudent, setActiveStudent] = useState<string | null>(null);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [studentMsg, setStudentMsg] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [authErr, setAuthErr] = useState('');
  const [cloudStudents, setCloudStudents] = useState<TeacherLink[]>([]); // طلابي المرتبطون بحساباتهم
  const [myTeachers, setMyTeachers] = useState<TeacherLink[]>([]); // معلّميّ (جهة الطالب)
  const [teacherCode, setTeacherCode] = useState('');
  const [teacherLabel, setTeacherLabel] = useState('');
  const [teacherMsg, setTeacherMsg] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailVal, setEmailVal] = useState('');
  const [otpVal, setOtpVal] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMsg, setOtpMsg] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [wordTexts, setWordTexts] = useState<Map<string, string>>(new Map());
  const [errorFilter, setErrorFilter] = useState<ErrorType | 'all'>('all');
  const [listPrint, setListPrint] = useState<ListEntry[][] | null>(null);
  const [listBusy, setListBusy] = useState('');
  const [importCode, setImportCode] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [copiedStudentId, setCopiedStudentId] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [shareCard, setShareCard] = useState<{
    name: string;
    sessions: number;
    marksCount: number;
    repeated: number;
    improvement: number | null;
  } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [playingAyah, setPlayingAyah] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hifzOpen, setHifzOpen] = useState(false);
  const [hifzSurah, setHifzSurah] = useState(1);
  const [hifzFrom, setHifzFrom] = useState('1');
  const [hifzTo, setHifzTo] = useState('1');
  const [hifzRepeat, setHifzRepeat] = useState('1');
  const [hifzRounds, setHifzRounds] = useState('1');
  const [hifzMsg, setHifzMsg] = useState('');
  const [hifzStatus, setHifzStatus] = useState<{
    ayah: number;
    iter: number;
    round: number;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [layoutId, setLayoutId] = useState<LayoutId>('madani');
  const [layoutChapters, setLayoutChapters] = useState<Record<
    string,
    [number, number]
  > | null>(null);
  const [mushafOpen, setMushafOpen] = useState(false);

  const layoutCfg = LAYOUTS[layoutId];
  const totalPages = layoutCfg.totalPages;
  const fetchPage = useCallback(
    (p: number) => fetchLayoutPage(layoutCfg.dir, p),
    [layoutCfg.dir]
  );

  // فهرس سور المخطط غير المدني (سورة → [أول صفحة، آخرها])
  useEffect(() => {
    if (layoutId === 'madani') {
      setLayoutChapters(null);
      return;
    }
    fetch(`/quran/${LAYOUTS[layoutId].dir}/chapters.json`)
      .then((r) => r.json())
      .then(setLayoutChapters);
  }, [layoutId]);
  const hifzStopRef = useRef(true);
  const pageRef = useRef(1);
  const [reciter, setReciter] = useState(DEFAULT_RECITER);
  const [liveIdentity, setLiveIdentity] = useState('');
  const liveChannelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabase>>['channel']
  > | null>(null);
  const loadSeq = useRef(0);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef(''); // الهوية النشطة: المالكة (حساب أو جهاز) أو الطالب المختار
  const ownerRef = useRef(''); // هوية المالكة: معرّف حساب Google إن سُجّل الدخول، وإلا معرّف الجهاز

  // قائمة الطلاب الموحّدة: المرتبطون بحساباتهم (سحابياً) + المضافون يدوياً برمزهم
  const allStudents = useMemo(() => {
    const cloud = cloudStudents.map((l) => ({
      id: l.student_id,
      name: l.student_name || 'طالب',
      cloud: true,
    }));
    const cloudIds = new Set(cloud.map((c) => c.id));
    const local = students
      .filter((s) => !cloudIds.has(s.id))
      .map((s) => ({ ...s, cloud: false }));
    return [...cloud, ...local];
  }, [cloudStudents, students]);

  const activeName = activeStudent
    ? allStudents.find((s) => s.id === activeStudent)?.name ?? 'الطالب'
    : null;

  // تحميل الروابط السحابية (طلابي + معلّميّ) عند توفر حساب
  const refreshLinks = useCallback(async (hasUser: boolean) => {
    if (!hasUser) {
      setCloudStudents([]);
      setMyTeachers([]);
      return;
    }
    const [studentsLinks, teacherLinks] = await Promise.all([
      fetchMyLinkedStudents(),
      fetchMyTeachers(),
    ]);
    setCloudStudents(studentsLinks);
    setMyTeachers(teacherLinks);
  }, []);

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
  const stats = useMemo(() => computeStats(marks), [marks]);

  // قائمة الأخطاء مجمّعة بالجلسات (الأحدث أولاً) ومرتبة بالصفحة ثم موضع الكلمة
  const marksByDate = useMemo(() => {
    const g = new Map<string, ErrorMark[]>();
    for (const m of marks) {
      const list = g.get(m.date) ?? [];
      list.push(m);
      g.set(m.date, list);
    }
    return [...g.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, list]) => ({
        date,
        list: list.sort(
          (a, b) => a.page - b.page || a.wordId.localeCompare(b.wordId, undefined, { numeric: true })
        ),
      }));
  }, [marks]);

  // القائمة بعد تصفية نوع الخطأ
  const filteredByDate = useMemo(
    () =>
      marksByDate
        .map((g) => ({
          date: g.date,
          list: errorFilter === 'all' ? g.list : g.list.filter((m) => m.type === errorFilter),
        }))
        .filter((g) => g.list.length > 0),
    [marksByDate, errorFilter]
  );

  // نصوص الكلمات المرصودة: تُجلب صفحاتها عند فتح الإحصاءات
  useEffect(() => {
    if (!statsOpen || marks.length === 0) return;
    const pages = [...new Set(marks.map((m) => m.page))];
    Promise.all(pages.map(fetchPage)).then((datas) => {
      const map = new Map<string, string>();
      for (const d of datas)
        for (const v of d.verses)
          for (const w of v.words) if (w.type === 'word') map.set(w.id, w.text);
      setWordTexts(map);
    });
  }, [statsOpen, marks]);

  // مزامنة هوية معيّنة مع السحابة: دمج المحلي والسحابي (الأحدث يغلب) ورفع الناقص
  const syncFor = useCallback(async (identity: string, local: ErrorMark[]) => {
    if (!getSupabase()) return;
    setSyncState('syncing');
    const remote = await fetchRemoteMarks(identity);
    if (identityRef.current !== identity) return; // تم التبديل لملف آخر أثناء الجلب
    if (remote === null) {
      setSyncState('error');
      return;
    }
    const merged = new Map<string, ErrorMark>();
    for (const m of [...local, ...remote]) {
      const prev = merged.get(m.id);
      if (!prev || m.createdAt >= prev.createdAt) merged.set(m.id, m);
    }
    const all = [...merged.values()];
    setMarks(all);
    saveMarks(identity, all);
    const remoteIds = new Set(remote.map((m) => m.id));
    const missing = all.filter((m) => !remoteIds.has(m.id));
    const ok = await pushMarks(identity, missing);
    if (identityRef.current === identity) setSyncState(ok ? 'ok' : 'error');
  }, []);

  // التبديل بين مصحف المالكة وملفات الطلاب: كل هوية لها علاماتها وجلساتها وطبقاتها
  const switchProfile = useCallback(
    (studentId: string | null) => {
      setActiveStudent(studentId);
      saveActiveStudent(studentId);
      const identity = studentId ?? ownerRef.current;
      identityRef.current = identity;
      setIdentity(studentId);
      setLiveIdentity(identity);
      setPopover(null);
      const local = loadMarks(identity);
      setMarks(local);
      try {
        const h = JSON.parse(
          localStorage.getItem(`rassd:hiddenDates:${identity}`) ?? '[]'
        );
        setHiddenDates(new Set(Array.isArray(h) ? h : []));
      } catch {
        setHiddenDates(new Set());
      }
      syncFor(identity, local);
    },
    [syncFor]
  );

  // تبنّي بيانات الجهاز عند أول دخول بالحساب: دمج علامات الجهاز في الحساب (مرة واحدة لكل حساب)
  const adoptDeviceData = useCallback(async (uid: string) => {
    const flag = `rassd:adopted:${uid}`;
    if (localStorage.getItem(flag)) return;
    const dev = getDeviceId();
    const merged = new Map<string, ErrorMark>();
    for (const m of [...loadMarks(uid), ...loadMarks(dev)]) {
      const prev = merged.get(m.id);
      if (!prev || m.createdAt >= prev.createdAt) merged.set(m.id, m);
    }
    // علامات الجهاز السحابية (المرفوعة قبل إنشاء الحساب) تُضم أيضاً
    const remoteDev = await fetchRemoteMarks(dev);
    if (remoteDev) {
      for (const m of remoteDev) {
        const prev = merged.get(m.id);
        if (!prev || m.createdAt >= prev.createdAt) merged.set(m.id, m);
      }
    }
    const all = [...merged.values()];
    saveMarks(uid, all);
    await pushMarks(uid, all);
    localStorage.setItem(flag, '1');
  }, []);

  // استرجاع آخر صفحة + الملفات + الحساب + تحميل أسماء السور
  useEffect(() => {
    const lay = loadLayout();
    setLayoutId(lay);
    const saved = Number(localStorage.getItem('rassd:page'));
    if (saved >= 1 && saved <= LAYOUTS[lay].totalPages) setPage(saved);
    setReciter(loadReciter());
    fetch('/quran/chapters.json')
      .then((r) => r.json())
      .then(setChapters);

    // ترحيل التخزين القديم (ما قبل الملفات) إلى مفتاح هوية الجهاز
    const dev = getDeviceId();
    migrateLegacyMarks(dev);
    const oldHidden = localStorage.getItem('rassd:hiddenDates');
    if (oldHidden !== null) {
      if (localStorage.getItem(`rassd:hiddenDates:${dev}`) === null) {
        localStorage.setItem(`rassd:hiddenDates:${dev}`, oldHidden);
      }
      localStorage.removeItem('rassd:hiddenDates');
    }

    const st = loadStudents();
    setStudents(st);

    const boot = async () => {
      const sessionUser = await getSessionUser();
      setUser(sessionUser);
      ownerRef.current = sessionUser?.id ?? dev;
      if (sessionUser) await adoptDeviceData(sessionUser.id);
      // روابط الحساب تُجلب قبل تفعيل الملف المحفوظ حتى لا يسقط طالب سحابي محفوظ
      let cloudIds: string[] = [];
      if (sessionUser) {
        const links = await fetchMyLinkedStudents();
        setCloudStudents(links);
        cloudIds = links.map((l) => l.student_id);
        fetchMyTeachers().then(setMyTeachers);
      }
      const act = loadActiveStudent();
      switchProfile(
        act && (st.some((s) => s.id === act) || cloudIds.includes(act)) ? act : null
      );

      // متابعة الدخول/الخروج بعد الإقلاع
      const sb = getSupabase();
      sb?.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        const nextOwner = nextUser?.id ?? getDeviceId();
        if (ownerRef.current === nextOwner) return;
        ownerRef.current = nextOwner;
        refreshLinks(!!nextUser);
        if (nextUser) {
          adoptDeviceData(nextUser.id).then(() => switchProfile(null));
        } else {
          switchProfile(null);
        }
      });
    };
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // الجلسة الحيّة: قناة بثّ لكل مصحف — أي كتابة عن بُعد ترسل «جرساً»
  // فيعيد الجهاز المشترك مزامنته فوراً (المعلّمة ترصد → تظهر عند الطالبة لحظياً)
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !liveIdentity) return;
    const ch = sb.channel(`rassd-live-${liveIdentity}`);
    ch.on('broadcast', { event: 'marks-changed' }, async () => {
      // السحابة مصدر الحقيقة هنا: استبدال لا دمج، حتى لا يعود المحذوف من النسخة المحلية
      const identity = identityRef.current;
      const remote = await fetchRemoteMarks(identity);
      if (remote === null || identityRef.current !== identity) return;
      setMarks(remote);
      saveMarks(identity, remote);
      setSyncState('ok');
    }).subscribe();
    liveChannelRef.current = ch;
    return () => {
      sb.removeChannel(ch);
      liveChannelRef.current = null;
    };
  }, [liveIdentity, syncFor]);

  const broadcastChange = useCallback(() => {
    liveChannelRef.current?.send({ type: 'broadcast', event: 'marks-changed', payload: {} });
  }, []);

  // عدّاد المتواجدين الآن: حضور لحظي عبر Supabase Realtime Presence
  // (المفتاح = هوية الجهاز، فالشخص الواحد بعدة تبويبات يُحسب مرة واحدة)
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const channel = sb.channel('rassd-online', {
      config: { presence: { key: getDeviceId() } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const updateHiddenDates = useCallback((next: Set<string>) => {
    setHiddenDates(next);
    localStorage.setItem(
      `rassd:hiddenDates:${identityRef.current}`,
      JSON.stringify([...next])
    );
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
    if (page < totalPages) fetchPage(page + 1);
    if (page > 1) fetchPage(page - 1);
    pageRef.current = page;
    localStorage.setItem('rassd:page', String(page));
  }, [page, fetchPage]);

  const go = useCallback(
    (p: number) => {
      if (p >= 1 && p <= totalPages) setPage(p);
    },
    [totalPages]
  );

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
    if (identityRef.current) saveMarks(identityRef.current, next);
  }, []);

  // إدارة الطلاب — الرمز اختياري: إن تُرك فارغاً نولّد رمزاً جديداً (طالب بلا حساب ولا تطبيق)
  const addStudent = () => {
    const name = newName.trim();
    const code = newCode.trim() ? newCode.trim().toLowerCase() : crypto.randomUUID();
    if (!name) {
      setStudentMsg('اكتبي اسم الطالب');
      return;
    }
    if (!UUID_RE.test(code)) {
      setStudentMsg('رمز الطالب غير صحيح — الطالب ينسخه من «🔗 أجهزتي» في جهازه');
      return;
    }
    if (code === getDeviceId().toLowerCase()) {
      setStudentMsg('هذا رمزك أنتِ وليس رمز طالب');
      return;
    }
    if (students.some((s) => s.id === code)) {
      setStudentMsg('هذا الطالب مضاف من قبل');
      return;
    }
    const next = [...students, { id: code, name }];
    setStudents(next);
    saveStudents(next);
    setNewName('');
    setNewCode('');
    setStudentMsg('');
    setStudentsOpen(false);
    switchProfile(code);
  };

  // استيراد رصد قديم برمز إلى هوية المالكة (حساب أو جهاز)
  const doImport = async () => {
    const code = importCode.trim().toLowerCase();
    if (!UUID_RE.test(code)) {
      setImportMsg('الرمز غير صحيح — تأكدي من نسخه كاملاً');
      return;
    }
    setImportBusy(true);
    setImportMsg('');
    const imported = await fetchMarksByCode(code);
    setImportBusy(false);
    if (imported === null) {
      setImportMsg('تعذّر الجلب — تأكدي من الرمز والاتصال');
      return;
    }
    if (imported.length === 0) {
      setImportMsg('لا يوجد رصد محفوظ على هذا الرمز');
      return;
    }
    const owner = ownerRef.current;
    const merged = new Map<string, ErrorMark>();
    for (const m of [...loadMarks(owner), ...imported]) {
      const prev = merged.get(m.id);
      if (!prev || m.createdAt >= prev.createdAt) merged.set(m.id, m);
    }
    const all = [...merged.values()];
    saveMarks(owner, all);
    await pushMarks(owner, all);
    if (identityRef.current === owner) setMarks(all);
    setImportCode('');
    setImportMsg(`✅ تم استيراد ${arabicWordCount(imported.length)} إلى مصحفك`);
  };

  const removeStudent = (id: string) => {
    const next = students.filter((s) => s.id !== id);
    setStudents(next);
    saveStudents(next);
    if (activeStudent === id) switchProfile(null);
  };

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

  // توليد PDF حقيقي داخل المتصفح (يعمل على الجوال أيضاً حيث window.print معطّلة):
  // نرسم صفحات النطاق خارج الشاشة → نصوّر كل صفحة canvas → نجمعها في ملف PDF وينزل مباشرة
  const doExport = async () => {
    const from = exportFrom ? Number(normalizeDigits(exportFrom)) : page;
    const to = exportTo ? Number(normalizeDigits(exportTo)) : from;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > totalPages) {
      setExportErr(`أدخلي أرقام صفحات بين ١ و${toArabicDigits(totalPages)}`);
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
    setExportBusy('يجهّز الصفحات…');
    try {
      const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);
      const datas = await Promise.all(nums.map(fetchPage));
      setPrintData(datas);
      await document.fonts.ready;
      // ننتظر حتى تُرسم كل الصفحات خارج الشاشة
      for (let tries = 0; tries < 60; tries++) {
        if (document.querySelectorAll('.print-page').length >= nums.length) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      await new Promise((r) => setTimeout(r, 150));

      const [{ toCanvas }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.print-page'));
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const MARGIN = 8;
      for (let i = 0; i < nodes.length; i++) {
        setExportBusy(`يصوّر صفحة ${toArabicDigits(nums[i])} (${toArabicDigits(i + 1)}/${toArabicDigits(nodes.length)})…`);
        const canvas = await toCanvas(nodes[i], {
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });
        const ratio = canvas.width / canvas.height;
        const maxW = 210 - MARGIN * 2;
        const maxH = 297 - MARGIN * 2;
        let h = maxH;
        let w = h * ratio;
        if (w > maxW) {
          w = maxW;
          h = w / ratio;
        }
        if (i > 0) pdf.addPage();
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.92),
          'JPEG',
          (210 - w) / 2,
          (297 - h) / 2,
          w,
          h
        );
      }
      pdf.save(`rassd-${from}${to !== from ? `-${to}` : ''}.pdf`);
      setExportOpen(false);
    } catch {
      setExportErr('تعذّر إنشاء الملف — جرّبي مرة أخرى أو قلّلي عدد الصفحات');
    } finally {
      setExportBusy('');
      setPrintData(null);
    }
  };

  // تصدير قائمة الأخطاء PDF: تقسيم الصفوف على صفحات A4 ثم نفس خط أنابيب التصوير
  const doListExport = async () => {
    if (filteredByDate.length === 0) return;
    setListBusy('يجهّز القائمة…');
    try {
      const entries: ListEntry[] = [];
      for (const g of filteredByDate) {
        entries.push({ kind: 'date', date: g.date, count: g.list.length });
        for (const m of g.list) entries.push({ kind: 'mark', m });
      }
      const PER_PAGE = 16;
      const chunks: ListEntry[][] = [];
      for (let i = 0; i < entries.length; i += PER_PAGE) chunks.push(entries.slice(i, i + PER_PAGE));
      setListPrint(chunks);
      await document.fonts.ready;
      for (let tries = 0; tries < 60; tries++) {
        if (document.querySelectorAll('.print-page').length >= chunks.length) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      await new Promise((r) => setTimeout(r, 150));

      const [{ toCanvas }, { jsPDF }] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
      ]);
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.print-page'));
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const MARGIN = 8;
      for (let i = 0; i < nodes.length; i++) {
        setListBusy(`يصوّر (${toArabicDigits(i + 1)}/${toArabicDigits(nodes.length)})…`);
        const canvas = await toCanvas(nodes[i], { pixelRatio: 2, backgroundColor: '#ffffff' });
        const ratio = canvas.width / canvas.height;
        const maxW = 210 - MARGIN * 2;
        let w = maxW;
        let h = w / ratio;
        const maxH = 297 - MARGIN * 2;
        if (h > maxH) {
          h = maxH;
          w = h * ratio;
        }
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - w) / 2, MARGIN, w, h);
      }
      pdf.save(`rassd-errors${errorFilter !== 'all' ? `-${errorFilter}` : ''}.pdf`);
    } catch {
      setListBusy('');
      setListPrint(null);
      alert('تعذّر إنشاء الملف — جرّبي مرة أخرى');
      return;
    }
    setListBusy('');
    setListPrint(null);
  };

  // بطاقة تقرير الأسبوع: صورة أنيقة تُشارك واتساب (آخر ٧ أيام مقارنةً بالسبعة قبلها)
  const doShareCard = async () => {
    setShareBusy(true);
    try {
      const isoDaysAgo = (n: number) => {
        const d = new Date();
        d.setDate(d.getDate() - n);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
      };
      const weekStart = isoDaysAgo(6);
      const prevStart = isoDaysAgo(13);
      const cur = marks.filter((m) => m.date >= weekStart);
      const prev = marks.filter((m) => m.date >= prevStart && m.date < weekStart);
      const improvement =
        prev.length > 0 ? Math.round(((prev.length - cur.length) / prev.length) * 100) : null;
      setShareCard({
        name: activeName ?? 'مصحفي',
        sessions: new Set(cur.map((m) => m.date)).size,
        marksCount: cur.length,
        repeated: stats.repeatedWords,
        improvement,
      });
      await document.fonts.ready;
      // نصوّر المضيف LTR الملتفّ على البطاقة (لا البطاقة RTL نفسها) لتفادي القصّ
      let host: HTMLElement | null = null;
      for (let tries = 0; tries < 90; tries++) {
        host = document.querySelector<HTMLElement>('.share-host');
        if (host && host.offsetWidth > 0) break;
        await new Promise((r) => requestAnimationFrame(r));
      }
      if (!host) throw new Error('no card');
      // ننتظر استقرار الخطوط والقياسات
      await new Promise((r) => setTimeout(r, 250));
      const w = Math.ceil(host.getBoundingClientRect().width);
      const h = Math.ceil(host.getBoundingClientRect().height);
      const { toPng } = await import('html-to-image');
      const opts = {
        pixelRatio: 3,
        width: w,
        height: h,
        canvasWidth: w * 3,
        canvasHeight: h * 3,
        backgroundColor: '#ffffff', // لا شفافية — الشفاف يظهر أسود في بعض التطبيقات
        // نلغي التثبيت على النسخة المصوَّرة حتى لا يضيع المحتوى خارج الكادر
        style: {
          position: 'static' as const,
          margin: '0',
          left: 'auto',
          top: 'auto',
          transform: 'none',
        },
      };
      // سفاري/iOS يعيد أول التقاط فارغاً أحياناً — نلتقط ثلاث مرات ونعتمد الأخيرة
      let dataUrl = '';
      for (let i = 0; i < 3; i++) dataUrl = await toPng(host, opts);
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'rassd-report.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'تقرير رصد' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'rassd-report.png';
        a.click();
      }
    } catch {
      alert('تعذّر إنشاء البطاقة — جرّبي مرة أخرى');
    } finally {
      setShareBusy(false);
      setShareCard(null);
    }
  };

  // البحث عن صفحة آية معيّنة ضمن نطاق صفحات سورتها (الصفحات مخبّأة في الذاكرة)
  const findPageOfVerse = useCallback(
    async (surah: number, ayah: number): Promise<number | null> => {
      const c = chapterMap.get(surah);
      if (!c) return null;
      const range =
        layoutId === 'madani' ? c.pages : layoutChapters?.[String(surah)];
      if (!range) return null;
      const key = `${surah}:${ayah}`;
      for (let p = range[0]; p <= range[1]; p++) {
        const d = await fetchPage(p);
        if (d.verses.some((v) => v.key === key)) return p;
      }
      return null;
    },
    [chapterMap, layoutId, layoutChapters, fetchPage]
  );

  // تبديل المصحف مع البقاء في نفس الموضع: نبحث عن صفحة أول آية ظاهرة في المخطط الجديد
  const switchLayout = useCallback(
    async (id: LayoutId) => {
      setMushafOpen(false);
      if (id === layoutId) return;
      const anchor = data?.verses[0]?.key ?? null;
      saveLayout(id);
      setLayoutId(id);
      const cfg = LAYOUTS[id];
      let target = Math.min(page, cfg.totalPages);
      if (anchor) {
        const [s] = anchor.split(':').map(Number);
        let range: [number, number] | undefined;
        if (id === 'madani') range = chapterMap.get(s)?.pages;
        else {
          try {
            const ch = await fetch(`/quran/${cfg.dir}/chapters.json`).then((r) => r.json());
            range = ch[String(s)];
          } catch {}
        }
        if (range) {
          for (let p = range[0]; p <= range[1]; p++) {
            const d = await fetchLayoutPage(cfg.dir, p);
            if (d.verses.some((v) => v.key === anchor)) {
              target = p;
              break;
            }
          }
        }
      }
      setPage(target);
    },
    [layoutId, data, page, chapterMap]
  );

  // مكرِّر الحفظ: تشغيل نطاق آيات، كل آية تتكرر N مرة، والمجموعة كلها لعدد جولات
  const stopHifz = useCallback(() => {
    hifzStopRef.current = true;
    audioRef.current?.pause();
    audioRef.current = null;
    setHifzStatus(null);
  }, []);

  const startHifz = async () => {
    const norm = (s: string) =>
      Number(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    const maxAyah = chapterMap.get(hifzSurah)?.verses ?? 286;
    const from = norm(hifzFrom);
    const to = norm(hifzTo);
    const repeat = norm(hifzRepeat);
    const rounds = hifzRounds === 'inf' ? Infinity : norm(hifzRounds);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > maxAyah) {
      setHifzMsg(`أدخلي آيات بين ١ و${toArabicDigits(maxAyah)}`);
      return;
    }
    if (to < from) {
      setHifzMsg('آية النهاية قبل آية البداية');
      return;
    }
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 50) {
      setHifzMsg('تكرار كل آية من ١ إلى ٥٠');
      return;
    }
    setHifzMsg('');
    setPlayingAyah(null);
    setHifzOpen(false); // التلاوة على المصحف نفسه، لا داخل النافذة
    hifzStopRef.current = false;
    outer: for (let round = 1; round <= rounds; round++) {
      for (let a = from; a <= to; a++) {
        if (hifzStopRef.current) break outer;
        // نقلب الصفحة تلقائياً إلى موضع الآية الحالية
        const versePage = await findPageOfVerse(hifzSurah, a);
        if (hifzStopRef.current) break outer;
        if (versePage && versePage !== pageRef.current) go(versePage);
        for (let i = 1; i <= repeat; i++) {
          if (hifzStopRef.current) break outer;
          setHifzStatus({ ayah: a, iter: i, round });
          await new Promise<void>((resolve) => {
            audioRef.current?.pause();
            const audio = new Audio(ayahAudioUrl(reciter, hifzSurah, a));
            audioRef.current = audio;
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        }
      }
    }
    hifzStopRef.current = true;
    setHifzStatus(null);
  };

  // سماع الآية بصوت القارئ المختار (CDN تلاوات quran.com المجاني) — ضغطة تشغّل وضغطة توقف
  const toggleAyahAudio = useCallback(
    (surah: number, ayah: number) => {
      const key = `${surah}:${ayah}`;
      if (playingAyah === key) {
        audioRef.current?.pause();
        audioRef.current = null;
        setPlayingAyah(null);
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(ayahAudioUrl(reciter, surah, ayah));
      audioRef.current = audio;
      setPlayingAyah(key);
      audio.onended = () => setPlayingAyah(null);
      audio.onerror = () => setPlayingAyah(null);
      audio.play().catch(() => setPlayingAyah(null));
    },
    [playingAyah, reciter]
  );

  const currentChapter = data?.verses[0]?.chapter ?? 1;
  const popoverMarks = popover ? pageMarks.get(popover.wordId) ?? [] : [];
  const sessionMark = popoverMarks.find((m) => m.date === sessionDate);

  // مسودة الملاحظة تتبع الكلمة المفتوحة: تعبّأ بملاحظة جلسة اليوم إن وُجدت
  useEffect(() => {
    setNoteDraft(sessionMark?.note ?? '');
    setNoteSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popover?.wordId, sessionDate]);

  const saveNote = () => {
    if (!popover || !sessionMark) return;
    const next = upsertMark(
      marks,
      popover.wordId,
      page,
      sessionMark.type,
      sessionDate,
      noteDraft.trim()
    );
    updateMarks(next);
    setNoteSaved(true);
    const saved = next.find((m) => m.id === `${popover.wordId}@${sessionDate}`);
    if (saved && getSupabase()) {
      setSyncState('syncing');
      pushMarks(identityRef.current, [saved]).then((ok) => {
        setSyncState(ok ? 'ok' : 'error');
        if (ok) broadcastChange();
      });
    }
  };

  const submitPageInput = () => {
    // تطبيع الأرقام العربية قبل التحقق
    const normalized = pageInput.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const n = Number(normalized);
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) go(n);
    setPageInput('');
  };

  return (
    <main className="app-root flex-1 flex flex-col items-center gap-5 px-4 py-6">
      {/* الترويسة */}
      <header className="w-full max-w-xl flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--green-deep)' }}>
            📖 رصد
          </h1>
          <p className="text-xs font-semibold opacity-70">
            مصحف إلكتروني — رواية حفص عن عاصم
          </p>
        </div>
        {user ? (
          <div className="account-chip">
            {user.user_metadata?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.user_metadata.avatar_url} alt="" className="account-avatar" />
            )}
            <span>{(user.user_metadata?.name as string)?.split(' ')[0] ?? 'حسابي'}</span>
            <button
              onClick={() => signOutAccount()}
              title="تسجيل الخروج — يرجع البرنامج لوضع الضيف على هذا الجهاز"
            >
              خروج
            </button>
          </div>
        ) : syncState !== 'off' ? (
          <div className="flex gap-2 flex-wrap">
            <button
              className="google-btn"
              onClick={async () => {
                setAuthErr('');
                const err = await signInWithGoogle();
                if (err) setAuthErr(err);
              }}
            >
              <span className="google-g">G</span> الدخول بـ Google
            </button>
            <button
              className="google-btn"
              onClick={() => {
                setEmailVal('');
                setOtpVal('');
                setOtpSent(false);
                setOtpMsg('');
                setEmailOpen(true);
              }}
            >
              ✉️ برمز إيميل
            </button>
          </div>
        ) : null}
        {authErr && <p className="export-error w-full">⚠️ {authErr}</p>}
      </header>

      {/* أدوات التنقل */}
      <div className="controls w-full max-w-xl flex flex-wrap items-center gap-2 justify-center">
        <select
          value={currentChapter}
          onChange={(e) => {
            const c = chapterMap.get(Number(e.target.value));
            if (!c) return;
            const start =
              layoutId === 'madani'
                ? c.pages[0]
                : layoutChapters?.[String(c.id)]?.[0] ?? 1;
            go(start);
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
          placeholder={`صفحة ١-${toArabicDigits(totalPages)}`}
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
          <button className="nav-btn" onClick={() => go(page + 1)} disabled={page >= totalPages}>
            التالية ◀
          </button>
        </div>
      </div>

      {/* شريط الأدوات: الاستماع والتصدير والإحصاءات بأزرار متساوية */}
      <div className="tools-bar w-full max-w-xl">
        <button
          className="tool-btn"
          onClick={() => {
            // تعبئة افتراضية من آيات الصفحة الحالية
            const first = data?.verses[0];
            const last = data?.verses[data.verses.length - 1];
            if (first) {
              const [s, a1] = first.key.split(':').map(Number);
              setHifzSurah(s);
              setHifzFrom(String(a1));
              const sameSurah = data!.verses.filter((v) => v.chapter === s);
              const a2 = Number(sameSurah[sameSurah.length - 1].key.split(':')[1]);
              setHifzTo(String(a2));
            } else if (last) {
              setHifzSurah(last.chapter);
            }
            setHifzMsg('');
            setHifzOpen(true);
          }}
        >
          🎧 الاستماع
        </button>
        <button
          className="tool-btn"
          onClick={() => {
            setExportFrom(String(page));
            setExportTo(String(page));
            setExportErr('');
            setExportOpen(true);
          }}
        >
          📄 تصدير PDF
        </button>
        <button className="tool-btn" onClick={() => setStatsOpen(true)}>
          📊 الإحصاءات
        </button>
        <button className="tool-btn" onClick={() => setMushafOpen(true)}>
          📖 المصحف
        </button>
      </div>

      {/* شريط الملفات: أرصد في مصحفي أو مصحف أحد طلابي */}
      <div className="controls profile-bar w-full max-w-xl">
        <label className="profile-label">
          ✍️ أرصد في:
          <select
            value={activeStudent ?? ''}
            onChange={(e) => {
              if (e.target.value === '__manage') {
                setStudentMsg('');
                setStudentsOpen(true);
                return;
              }
              switchProfile(e.target.value || null);
            }}
            aria-label="اختيار المصحف"
          >
            <option value="">👤 مصحفي</option>
            {allStudents.map((s) => (
              <option key={s.id} value={s.id}>
                🎓 {s.name}
              </option>
            ))}
            <option value="__manage">👥 إدارة طلابي…</option>
          </select>
        </label>
        {activeName && (
          <span className="student-active-badge">
            الرصد يُحفظ في مصحف {activeName} ويظهر عنده مباشرة
          </span>
        )}
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
        <span
          className={`sync-badge sync-${syncState}`}
          title={
            syncState === 'ok'
              ? 'الرصد محفوظ في السحابة'
              : syncState === 'syncing'
                ? 'جاري المزامنة…'
                : syncState === 'error'
                  ? 'تعذّرت المزامنة — الرصد محفوظ محلياً وسيُرفع لاحقاً'
                  : 'الحفظ محلي فقط'
          }
        >
          {syncState === 'ok' && '☁️ متزامن'}
          {syncState === 'syncing' && '⏳ يزامن…'}
          {syncState === 'error' && '⚠️ محلي'}
          {syncState === 'off' && '💾 محلي'}
        </span>
        {onlineCount > 0 && (
          <span className="online-badge" title="عدد المتواجدين في التطبيق الآن">
            <i className="online-dot" /> المتواجدون الآن: {toArabicDigits(onlineCount)}
          </span>
        )}
        {syncState !== 'off' && (
          <button
            className="link-devices-btn"
            onClick={() => {
              setLinkInput('');
              setLinkMsg('');
              setCopied(false);
              setLinkOpen(true);
            }}
          >
            {user ? '🔗 رمزي' : '🔗 أجهزتي'}
          </button>
        )}
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
            activeVerse={hifzStatus ? `${hifzSurah}:${hifzStatus.ayah}` : null}
            layout={layoutId}
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
                      const next = upsertMark(
                        marks,
                        popover.wordId,
                        page,
                        k,
                        sessionDate,
                        sessionMark?.note ?? ''
                      );
                      updateMarks(next);
                      const added = next.find((m) => m.id === `${popover.wordId}@${sessionDate}`);
                      if (added && getSupabase()) {
                        setSyncState('syncing');
                        pushMarks(identityRef.current, [added]).then((ok) => {
                          setSyncState(ok ? 'ok' : 'error');
                          if (ok) broadcastChange();
                        });
                      }
                      // رصد على طبقة مخفيّة يُظهرها تلقائياً حتى لا يختفي الرصد الجديد
                      if (hiddenDates.has(sessionDate)) {
                        const nextHidden = new Set(hiddenDates);
                        nextHidden.delete(sessionDate);
                        updateHiddenDates(nextHidden);
                      }
                      setPopover(null);
                    }}
                  >
                    {ERROR_TYPES[k].label}
                  </button>
                ))}
              </div>
              {/* ملاحظات الجلسات السابقة على هذه الكلمة — بطاقات للقراءة */}
              {popoverMarks
                .filter((m) => m.note && m.date !== sessionDate)
                .map((m) => (
                  <div key={m.id} className="teacher-note">
                    <span className="teacher-note-text">💬 {m.note}</span>
                    <span className="teacher-note-date">{formatArabicDate(m.date)}</span>
                  </div>
                ))}

              {/* كتابة/تعديل ملاحظة جلسة اليوم — تظهر بعد تحديد نوع الخطأ */}
              {sessionMark && (
                <div className="note-editor">
                  <textarea
                    className="note-input"
                    rows={2}
                    placeholder="💬 ملاحظة للطالب… (مثال: مدّ لازم ٦ حركات)"
                    value={noteDraft}
                    onChange={(e) => {
                      setNoteDraft(e.target.value);
                      setNoteSaved(false);
                    }}
                  />
                  {(noteDraft.trim() !== (sessionMark.note ?? '') || noteSaved) && (
                    <button className="note-save-btn" onClick={saveNote} disabled={noteSaved}>
                      {noteSaved ? '✓ حُفظت الملاحظة' : '💾 حفظ الملاحظة'}
                    </button>
                  )}
                </div>
              )}

              <button
                className="listen-btn"
                onClick={() => {
                  const [s, a] = popover.wordId.split(':').map(Number);
                  toggleAyahAudio(s, a);
                }}
              >
                {playingAyah === popover.wordId.split(':').slice(0, 2).join(':')
                  ? '⏹ إيقاف التلاوة'
                  : '🔊 سماع الآية'}
              </button>
              {popoverMarks.length > 0 && (
                <button
                  className="remove-btn"
                  onClick={() => {
                    updateMarks(removeWordMarks(marks, popover.wordId));
                    if (getSupabase()) {
                      setSyncState('syncing');
                      deleteRemoteMarks(identityRef.current, popover.wordId).then((ok) => {
                        setSyncState(ok ? 'ok' : 'error');
                        if (ok) broadcastChange();
                      });
                    }
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

      {/* شريط مكرِّر الحفظ العائم — يظهر أثناء التلاوة على المصحف */}
      {hifzStatus && (
        <div className="hifz-bar">
          <span className="hifz-bar-text">
            🎧 {chapterMap.get(hifzSurah)?.name ?? ''} — الآية{' '}
            {toArabicDigits(hifzStatus.ayah)} · تكرار {toArabicDigits(hifzStatus.iter)}/
            {toArabicDigits(Number(hifzRepeat) || 1)}
            {hifzRounds === 'inf'
              ? ` · الإعادة ${toArabicDigits(hifzStatus.round)} ∞`
              : Number(hifzRounds) > 1
                ? ` · الإعادة ${toArabicDigits(hifzStatus.round)}/${toArabicDigits(Number(hifzRounds))}`
                : ''}
          </span>
          <button className="hifz-bar-stop" onClick={stopHifz}>
            ⏹ إيقاف
          </button>
        </div>
      )}

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
              <button className="nav-btn" onClick={doExport} disabled={!!exportBusy}>
                {exportBusy || '⬇️ تنزيل PDF'}
              </button>
              <button
                className="cancel-btn"
                onClick={() => setExportOpen(false)}
                disabled={!!exportBusy}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* اختيار نوع المصحف — التعرف على مصحف الطالبة ببصمة الصفحة ٣٠٠ */}
      {mushafOpen && (
        <div className="export-backdrop" onClick={() => setMushafOpen(false)}>
          <div className="export-dialog controls" onClick={(e) => e.stopPropagation()}>
            <h2>📖 نوع المصحف</h2>
            <p className="export-hint">
              ما تعرفين أي مصحف عند الطالبة؟ اطلبي منها تفتح مصحفها الورقي على
              <b> الصفحة ٣٠٠ </b>
              وتقارن أول كلماتها بالبطاقات — كل مصحف يبدأ بكلمات مختلفة:
            </p>
            {(Object.values(LAYOUTS) as (typeof LAYOUTS)[LayoutId][]).map((l) => (
              <button
                key={l.id}
                className={`mushaf-choice ${l.id === layoutId ? 'active' : ''}`}
                onClick={() => switchLayout(l.id)}
              >
                <span className="mushaf-choice-head">
                  <b>{l.name}</b>
                  {l.id === layoutId && <em>✓ الحالي</em>}
                </span>
                <span className="mushaf-choice-meta">
                  {toArabicDigits(l.totalPages)} صفحة · {toArabicDigits(l.lines)} سطراً في
                  الصفحة
                </span>
                <span
                  className={`mushaf-choice-sample ${l.font === 'indopak' ? 'font-indopak' : 'font-uthmani'}`}
                >
                  {l.sampleWords}
                </span>
                <span className="mushaf-choice-ref">
                  أول صفحة ٣٠٠ — {l.sampleRef}
                </span>
              </button>
            ))}
            <p className="export-hint dim-hint">
              رصد الأخطاء واحد مهما كان المصحف — العلامات على الكلمات نفسها تظهر
              في أي مخطط تختارينه، وفقط أرقام الصفحات تختلف.
            </p>
            <div className="export-actions">
              <button className="cancel-btn" onClick={() => setMushafOpen(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مكرِّر الحفظ */}
      {hifzOpen && (
        <div
          className="export-backdrop"
          onClick={() => {
            stopHifz();
            setHifzOpen(false);
          }}
        >
          <div className="export-dialog controls" onClick={(e) => e.stopPropagation()}>
            <h2>🎧 الاستماع والتكرار</h2>
            <p className="export-hint">
              اختاري الآيات وعدد التكرار، واتركي التلاوة تعيد عليك — كل آية تتكرر
              العدد المحدّد ثم تنتقل للتي بعدها، والمقطع كاملاً يُعاد بالعدد الذي
              تختارينه أو بلا توقف حتى توقفينه.
            </p>
            <label className="sync-code-label">
              القارئ:
              <select
                value={reciter}
                onChange={(e) => {
                  setReciter(e.target.value);
                  saveReciter(e.target.value);
                }}
              >
                {RECITERS.map((r) => (
                  <option key={r.id} value={r.id}>
                    🎙️ {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sync-code-label">
              السورة:
              <select
                value={hifzSurah}
                onChange={(e) => {
                  setHifzSurah(Number(e.target.value));
                  setHifzFrom('1');
                  setHifzTo('1');
                }}
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {toArabicDigits(c.id)}. {c.name} ({toArabicDigits(c.verses)} آية)
                  </option>
                ))}
              </select>
            </label>
            <div className="export-range">
              <label>
                من آية
                <input
                  type="text"
                  inputMode="numeric"
                  value={hifzFrom}
                  onChange={(e) => setHifzFrom(e.target.value)}
                />
              </label>
              <label>
                إلى آية
                <input
                  type="text"
                  inputMode="numeric"
                  value={hifzTo}
                  onChange={(e) => setHifzTo(e.target.value)}
                />
              </label>
            </div>
            <div className="export-range">
              <label>
                تكرار كل آية
                <input
                  type="text"
                  inputMode="numeric"
                  value={hifzRepeat}
                  onChange={(e) => setHifzRepeat(e.target.value)}
                />
              </label>
              <label>
                إعادة المقطع كاملاً
                <select value={hifzRounds} onChange={(e) => setHifzRounds(e.target.value)}>
                  <option value="1">مرة واحدة</option>
                  <option value="2">مرتين</option>
                  <option value="3">٣ مرات</option>
                  <option value="5">٥ مرات</option>
                  <option value="10">١٠ مرات</option>
                  <option value="inf">∞ بلا توقف — حتى أوقفها</option>
                </select>
              </label>
            </div>
            {hifzMsg && <p className="export-error">⚠️ {hifzMsg}</p>}
            {hifzStatus && (
              <p className="hifz-status">
                ▶️ الآية {toArabicDigits(hifzStatus.ayah)} — التكرار{' '}
                {toArabicDigits(hifzStatus.iter)}/{toArabicDigits(Number(hifzRepeat) || 1)}
                {hifzRounds === 'inf'
                  ? ` — الإعادة ${toArabicDigits(hifzStatus.round)} ∞`
                  : Number(hifzRounds) > 1
                    ? ` — الإعادة ${toArabicDigits(hifzStatus.round)}/${toArabicDigits(Number(hifzRounds))}`
                    : ''}
              </p>
            )}
            <div className="export-actions">
              {hifzStatus ? (
                <button className="nav-btn stop-btn" onClick={stopHifz}>
                  ⏹ إيقاف
                </button>
              ) : (
                <button className="nav-btn" onClick={startHifz}>
                  ▶️ ابدئي التلاوة
                </button>
              )}
              <button
                className="cancel-btn"
                onClick={() => {
                  stopHifz();
                  setHifzOpen(false);
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الإحصاءات */}
      {statsOpen && (
        <div className="export-backdrop" onClick={() => setStatsOpen(false)}>
          <div
            className="export-dialog controls stats-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stats-head-row">
              <h2>📊 إحصاءات {activeName ?? 'مصحفي'}</h2>
              {stats.totalWords > 0 && (
                <button className="jump-btn" disabled={shareBusy} onClick={doShareCard}>
                  {shareBusy ? '⏳ يجهّز…' : '📤 بطاقة مشاركة'}
                </button>
              )}
            </div>

            {stats.totalWords === 0 ? (
              <p className="layers-empty">
                لا يوجد رصد بعد — ابدئي التسميع وارصدي الأخطاء وسترين هنا تطوّرك
                جلسة بعد جلسة.
              </p>
            ) : (
              <>
                {/* بطاقات سريعة */}
                <div className="stats-cards">
                  <div className="stat-card">
                    <b>{toArabicDigits(stats.sessionsCount)}</b>
                    <span>جلسات</span>
                  </div>
                  <div className="stat-card">
                    <b>{toArabicDigits(stats.totalWords)}</b>
                    <span>كلمات مرصودة</span>
                  </div>
                  <div className="stat-card">
                    <b>{toArabicDigits(stats.pagesCount)}</b>
                    <span>صفحات</span>
                  </div>
                  <div className="stat-card warn">
                    <b>{toArabicDigits(stats.repeatedWords)}</b>
                    <span>كلمات متكرّرة الخطأ</span>
                  </div>
                </div>

                {/* تطوّر الجلسات */}
                <h3 className="stats-title">تطوّر الجلسات (عدد الأخطاء لكل جلسة)</h3>
                <div className="session-chart">
                  {stats.sessions.slice(-12).map((s) => {
                    const max = Math.max(...stats.sessions.slice(-12).map((x) => x.count));
                    return (
                      <div key={s.date} className="chart-col" title={formatArabicDate(s.date)}>
                        <span className="chart-count">{toArabicDigits(s.count)}</span>
                        <div
                          className="chart-bar"
                          style={{ height: `${Math.max(8, (s.count / max) * 100)}%` }}
                        />
                        <span className="chart-label">
                          {toArabicDigits(s.date.slice(8, 10))}/{toArabicDigits(s.date.slice(5, 7))}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* توزيع الأنواع */}
                <h3 className="stats-title">توزيع أنواع الأخطاء</h3>
                <div className="type-bars">
                  {(Object.keys(ERROR_TYPES) as ErrorType[]).map((k) => {
                    const total = Object.values(stats.types).reduce((a, b) => a + b, 0);
                    const pct = total ? Math.round((stats.types[k] / total) * 100) : 0;
                    return (
                      <div key={k} className="type-bar-row">
                        <span className="type-bar-label" style={{ color: ERROR_TYPES[k].color }}>
                          {ERROR_TYPES[k].label}
                        </span>
                        <div className="type-bar-track">
                          <div
                            className="type-bar-fill"
                            style={{ width: `${pct}%`, background: ERROR_TYPES[k].color }}
                          />
                        </div>
                        <span className="type-bar-count">
                          {toArabicDigits(stats.types[k])} ({toArabicDigits(pct)}٪)
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* أكثر الصفحات أخطاء */}
                <h3 className="stats-title">أكثر الصفحات أخطاءً</h3>
                <div className="students-list">
                  {stats.topPages.map((p) => (
                    <div key={p.page} className="student-row">
                      <span className="student-name">صفحة {toArabicDigits(p.page)}</span>
                      <span className="layer-count">
                        {toArabicDigits(p.count)} {p.count === 1 ? 'رصد' : 'أرصاد'}
                      </span>
                      <button
                        className="jump-btn"
                        onClick={() => {
                          go(p.page);
                          setStatsOpen(false);
                        }}
                      >
                        فتح ↗
                      </button>
                    </div>
                  ))}
                </div>

                {/* قائمة الأخطاء التفصيلية: الكلمة والسورة ورقم الآية */}
                <h3 className="stats-title">📝 قائمة الأخطاء</h3>
                <div className="filter-row">
                  <div className="filter-chips">
                    <button
                      className={`filter-chip ${errorFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setErrorFilter('all')}
                    >
                      الكل ({toArabicDigits(marks.length)})
                    </button>
                    {(Object.keys(ERROR_TYPES) as ErrorType[]).map((k) => (
                      <button
                        key={k}
                        className={`filter-chip ${errorFilter === k ? 'active' : ''}`}
                        style={{ color: ERROR_TYPES[k].color, background: ERROR_TYPES[k].bg }}
                        onClick={() => setErrorFilter(errorFilter === k ? 'all' : k)}
                      >
                        {ERROR_TYPES[k].label} ({toArabicDigits(stats.types[k])})
                      </button>
                    ))}
                  </div>
                  <button
                    className="jump-btn"
                    disabled={!!listBusy || filteredByDate.length === 0}
                    onClick={doListExport}
                  >
                    {listBusy || '🖨️ حفظ PDF'}
                  </button>
                </div>
                {filteredByDate.length === 0 && (
                  <p className="layers-empty">لا أخطاء من هذا النوع 🎉</p>
                )}
                {filteredByDate.map(({ date, list }) => (
                  <div key={date} className="error-list-group">
                    <h4 className="error-list-date">
                      🗓️ {formatArabicDate(date)} — {arabicWordCount(list.length)}
                    </h4>
                    {list.map((m) => {
                      const [surah, ayah] = m.wordId.split(':');
                      const t = ERROR_TYPES[m.type];
                      return (
                        <div key={`${m.id}@${m.date}`} className="error-item">
                          <span
                            className="error-word"
                            style={{
                              background: t.bg,
                              boxShadow: `inset 0 -0.12em 0 0 ${t.color}`,
                            }}
                          >
                            {wordTexts.get(m.wordId) ?? '…'}
                          </span>
                          <span className="error-meta">
                            <b>سورة {chapterMap.get(Number(surah))?.name ?? surah}</b> — آية{' '}
                            {toArabicDigits(ayah)}
                            <i className="error-type-tag" style={{ color: t.color }}>
                              {t.label}
                            </i>
                            {m.note && <span className="error-note">💬 {m.note}</span>}
                          </span>
                          <button
                            className="jump-btn"
                            onClick={() => {
                              go(m.page);
                              setStatsOpen(false);
                            }}
                          >
                            ص {toArabicDigits(m.page)} ↗
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}

            <div className="export-actions">
              <button className="cancel-btn" onClick={() => setStatsOpen(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الدخول برمز الإيميل */}
      {emailOpen && (
        <div className="export-backdrop" onClick={() => !otpBusy && setEmailOpen(false)}>
          <div className="export-dialog controls" onClick={(e) => e.stopPropagation()}>
            <h2>✉️ الدخول برمز الإيميل</h2>
            {!otpSent ? (
              <>
                <p className="export-hint">
                  اكتبي إيميلك وبنرسل لك رمز دخول — بدون كلمة مرور نهائياً. إذا
                  كانت أول مرة، ينشأ حسابك تلقائياً.
                </p>
                <label className="sync-code-label">
                  الإيميل:
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    value={emailVal}
                    onChange={(e) => setEmailVal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && emailVal.includes('@') && !otpBusy && (async () => {
                      setOtpBusy(true);
                      setOtpMsg('');
                      const err = await sendEmailOtp(emailVal.trim());
                      setOtpBusy(false);
                      if (err) setOtpMsg(err);
                      else setOtpSent(true);
                    })()}
                  />
                </label>
                {otpMsg && <p className="export-error">⚠️ {otpMsg}</p>}
                <div className="export-actions">
                  <button
                    className="nav-btn"
                    disabled={!emailVal.includes('@') || otpBusy}
                    onClick={async () => {
                      setOtpBusy(true);
                      setOtpMsg('');
                      const err = await sendEmailOtp(emailVal.trim());
                      setOtpBusy(false);
                      if (err) setOtpMsg(err);
                      else setOtpSent(true);
                    }}
                  >
                    {otpBusy ? '⏳ يرسل…' : '📨 أرسلي الرمز'}
                  </button>
                  <button className="cancel-btn" onClick={() => setEmailOpen(false)}>
                    إلغاء
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="export-hint">
                  أرسلنا رمزاً إلى <b dir="ltr">{emailVal.trim()}</b> — اكتبيه هنا
                  (أو اضغطي رابط الدخول في الرسالة نفسها). تفقّدي «غير المرغوب» إذا
                  تأخّر.
                </p>
                <label className="sync-code-label">
                  الرمز:
                  <input
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    placeholder="123456"
                    className="otp-input"
                    value={otpVal}
                    onChange={(e) => setOtpVal(e.target.value)}
                    autoFocus
                  />
                </label>
                {otpMsg && <p className="export-error">⚠️ {otpMsg}</p>}
                <div className="export-actions">
                  <button
                    className="nav-btn"
                    disabled={otpVal.trim().length < 6 || otpBusy}
                    onClick={async () => {
                      setOtpBusy(true);
                      setOtpMsg('');
                      const err = await verifyEmailOtp(emailVal.trim(), otpVal);
                      setOtpBusy(false);
                      if (err) {
                        setOtpMsg(err);
                        return;
                      }
                      setEmailOpen(false);
                      // onAuthStateChange يتكفّل بتبنّي البيانات وتحديث الواجهة
                    }}
                  >
                    {otpBusy ? '⏳ يتحقق…' : '✅ دخول'}
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpVal('');
                      setOtpMsg('');
                    }}
                  >
                    ↩︎ تغيير الإيميل
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* نافذة إدارة الطلاب */}
      {studentsOpen && (
        <div className="export-backdrop" onClick={() => setStudentsOpen(false)}>
          <div className="export-dialog controls" onClick={(e) => e.stopPropagation()}>
            <h2>👥 طلابي</h2>
            {user ? (
              <>
                <p className="export-hint">
                  أرسلي رمزك هذا لطلابك — كل طالب مسجَّل بحسابه يضيفه من «🎓 معلّمي»
                  عنده، فيظهر هنا باسمه تلقائياً. وعندها كل ما ترصدينه له يظهر في
                  «جلسات التسميع» عنده مباشرة، ويستطيع إلغاء الربط متى شاء.
                </p>
                <div className="sync-code-box">
                  <code>{user.id}</code>
                  <button
                    className="nav-btn"
                    onClick={() =>
                      navigator.clipboard?.writeText(user.id).then(() => setCopied(true))
                    }
                  >
                    {copied ? '✓ نُسخ' : '📋 نسخ رمزي'}
                  </button>
                </div>
              </>
            ) : (
              <p className="export-hint">
                يفتح الطالب «رصد» في جهازه → «🔗 أجهزتي» → ينسخ رمزه ويرسله لك.
                أضيفيه هنا باسمه ورمزه، ثم اختاريه من «أرصد في» — كل ما ترصدينه
                يُحفظ في مصحف الطالب نفسه ويظهر في «جلسات التسميع» عنده مباشرة.
              </p>
            )}
            {allStudents.length > 0 && (
              <div className="students-list">
                {allStudents.map((s) => (
                  <div key={s.id} className="student-row">
                    <span className="student-name">
                      🎓 {s.name} {s.cloud && <em className="cloud-tag">☁️ بحسابه</em>}
                    </span>
                    <button
                      className="copy-code-btn"
                      title="نسخ رمز الطالب — أرسليه له ليستلم جلساته في جهازه أو حسابه"
                      onClick={() => {
                        navigator.clipboard?.writeText(s.id).then(() => {
                          setCopiedStudentId(s.id);
                          setTimeout(() => setCopiedStudentId(''), 2000);
                        });
                      }}
                    >
                      {copiedStudentId === s.id ? '✓ نُسخ' : '📋 رمزه'}
                    </button>
                    <button
                      className="student-remove"
                      title={
                        s.cloud
                          ? 'فكّ الارتباط بهذا الطالب'
                          : 'إزالة الطالب من قائمتي (لا يحذف رصده)'
                      }
                      onClick={async () => {
                        if (s.cloud && user) {
                          await removeTeacherLink(s.id, user.id);
                          if (activeStudent === s.id) switchProfile(null);
                          refreshLinks(true);
                        } else {
                          removeStudent(s.id);
                        }
                      }}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="export-hint dim-hint">
              {user
                ? 'أو أضيفي طالباً بلا حساب: بالاسم فقط (نولّد له رمزاً) أو برمز جهازه إن كان عنده التطبيق. لاحقاً أرسلي له رمزه من زر «📋 رمزه» ليستلم كل جلساته.'
                : 'أضيفي الطالب بالاسم فقط (نولّد له رمزاً) أو برمز جهازه إن كان عنده التطبيق.'}
            </p>
            <label className="sync-code-label">
              اسم الطالب:
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: أحمد"
              />
            </label>
            <label className="sync-code-label">
              رمز الطالب (اختياري):
              <input
                type="text"
                dir="ltr"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="اتركيه فارغاً لطالب بلا تطبيق"
              />
            </label>
            {studentMsg && <p className="export-error">⚠️ {studentMsg}</p>}
            <div className="export-actions">
              <button className="nav-btn" onClick={addStudent}>
                ➕ إضافة الطالب
              </button>
              <button className="cancel-btn" onClick={() => setStudentsOpen(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة ربط الأجهزة */}
      {linkOpen && (
        <div className="export-backdrop" onClick={() => setLinkOpen(false)}>
          <div className="export-dialog controls" onClick={(e) => e.stopPropagation()}>
            <h2>{user ? '🔗 رمزي' : '🔗 ربط أجهزتي'}</h2>
            <p className="export-hint">
              {user
                ? 'حسابك يزامن أجهزتك تلقائياً — سجّلي الدخول بنفس الحساب على أي جهاز. وهذا رمزك ترسلينه لمعلّمك ليضيفك في «👥 طلابي».'
                : 'عشان يظهر نفس الرصد على جوالك وكمبيوترك: انسخي الرمز من جهازك الأساسي، وافتحي «رصد» على الجهاز الآخر والصقيه هناك ثم اضغطي «ربط». وإذا كان لك معلّم يتابعك: أرسلي له هذا الرمز نفسه ليضيفك في «👥 طلابي».'}
            </p>
            <div className="sync-code-box">
              <code>{user?.id ?? getDeviceId()}</code>
              <button
                className="nav-btn"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(user?.id ?? getDeviceId())
                    .then(() => setCopied(true));
                }}
              >
                {copied ? '✓ نُسخ' : '📋 نسخ الرمز'}
              </button>
            </div>
            {!user && (
              <label className="sync-code-label">
                الصقي رمز الجهاز الآخر هنا:
                <input
                  type="text"
                  dir="ltr"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                />
              </label>
            )}

            {/* جهة الطالب: معلّميّ المرتبطون بي مع إمكانية الإلغاء */}
            {user && (
              <div className="teachers-section">
                <h3>🎓 معلّمي</h3>
                {myTeachers.length > 0 && (
                  <div className="students-list">
                    {myTeachers.map((t) => (
                      <div key={t.teacher_id} className="student-row">
                        <span className="student-name">
                          {t.teacher_label || 'معلّمي'}
                        </span>
                        <code>{t.teacher_id.slice(0, 8)}…</code>
                        <button
                          className="student-remove"
                          title="إلغاء مشاركة مصحفي مع هذا المعلّم"
                          onClick={async () => {
                            await removeTeacherLink(user.id, t.teacher_id);
                            refreshLinks(true);
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="sync-code-label">
                  رمز المعلّم:
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                  />
                </label>
                <label className="sync-code-label">
                  اسم المعلّم (اختياري):
                  <input
                    type="text"
                    value={teacherLabel}
                    onChange={(e) => setTeacherLabel(e.target.value)}
                    placeholder="مثال: أ. سارة"
                  />
                </label>
                {teacherMsg && <p className="export-error">⚠️ {teacherMsg}</p>}
                <button
                  className="nav-btn"
                  disabled={!teacherCode.trim()}
                  onClick={async () => {
                    setTeacherMsg('');
                    const myName =
                      (user.user_metadata?.name as string) ??
                      user.email?.split('@')[0] ??
                      'طالب';
                    const err = await addTeacherLink(teacherCode, myName, teacherLabel.trim());
                    if (err) {
                      setTeacherMsg(err);
                      return;
                    }
                    setTeacherCode('');
                    setTeacherLabel('');
                    refreshLinks(true);
                  }}
                >
                  ➕ ربط معلّمي بمصحفي
                </button>
              </div>
            )}

            {/* استيراد رصد قديم: إذا كانت المعلّمة ترصد لك برمز قبل إنشاء حسابك */}
            {user && (
              <div className="teachers-section">
                <h3>📥 استيراد رصد قديم</h3>
                <p className="export-hint">
                  إذا كانت معلّمتك ترصد لك برمز قبل أن يكون لك حساب: اطلبي منها
                  رمزك (زر «📋 رمزه» عندها) والصقيه هنا — كل جلساتك القديمة تنتقل
                  إلى حسابك.
                </p>
                <label className="sync-code-label">
                  الرمز القديم:
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={importCode}
                    onChange={(e) => setImportCode(e.target.value)}
                  />
                </label>
                {importMsg && (
                  <p className={importMsg.startsWith('✅') ? 'import-ok' : 'export-error'}>
                    {importMsg}
                  </p>
                )}
                <button
                  className="nav-btn"
                  disabled={!importCode.trim() || importBusy}
                  onClick={doImport}
                >
                  {importBusy ? '⏳ يستورد…' : '📥 استيراد إلى مصحفي'}
                </button>
              </div>
            )}
            {linkMsg && <p className="export-error">⚠️ {linkMsg}</p>}
            <div className="export-actions">
              {!user && (
                <button
                  className="nav-btn"
                  disabled={!linkInput.trim()}
                  onClick={() => {
                    const oldId = getDeviceId();
                    const result = adoptSyncCode(linkInput);
                    if (result === 'invalid') {
                      setLinkMsg('الرمز غير صحيح — تأكدي من نسخه كاملاً');
                      return;
                    }
                    if (result === 'same') {
                      setLinkMsg('هذا رمز جهازك الحالي نفسه');
                      return;
                    }
                    // دمج رصد الهوية القديمة محلياً في الجديدة قبل إعادة التحميل،
                    // والمزامنة الأولية بعدها ترفع الناقص للسحابة
                    const newId = linkInput.trim().toLowerCase();
                    const merged = new Map<string, ErrorMark>();
                    for (const m of [...loadMarks(newId), ...loadMarks(oldId)]) {
                      const prev = merged.get(m.id);
                      if (!prev || m.createdAt >= prev.createdAt) merged.set(m.id, m);
                    }
                    saveMarks(newId, [...merged.values()]);
                    window.location.reload();
                  }}
                >
                  🔗 ربط
                </button>
              )}
              <button className="cancel-btn" onClick={() => setLinkOpen(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* بطاقة المشاركة — تُرسم في مضيف مخفي ثابت (LTR) ثم تُصوَّر البطاقة نفسها */}
      {shareCard &&
        createPortal(
          <div className="share-host" dir="ltr">
            <div className="share-card" dir="rtl">
              <div className="share-brand">📖 رصد</div>
              <div className="share-title">تقرير الأسبوع</div>
              <div className="share-name">{shareCard.name}</div>
              <div className="share-stats">
                <div className="share-stat">
                  <b>{toArabicDigits(shareCard.sessions)}</b>
                  <span>{shareCard.sessions === 1 ? 'جلسة تسميع' : 'جلسات تسميع'}</span>
                </div>
                <div className="share-stat">
                  <b>{toArabicDigits(shareCard.marksCount)}</b>
                  <span>أخطاء مرصودة</span>
                </div>
                <div className="share-stat">
                  <b>{toArabicDigits(shareCard.repeated)}</b>
                  <span>كلمات متكرّرة</span>
                </div>
              </div>
              {shareCard.improvement !== null && (
                <div className={`share-improve ${shareCard.improvement >= 0 ? 'good' : 'bad'}`}>
                  {shareCard.improvement >= 0
                    ? `📉 الأخطاء أقل بنسبة ${toArabicDigits(Math.abs(shareCard.improvement))}٪ عن الأسبوع الماضي — ما شاء الله!`
                    : `📈 الأخطاء زادت ${toArabicDigits(Math.abs(shareCard.improvement))}٪ عن الأسبوع الماضي — نشدّ الهمّة 💪`}
                </div>
              )}
              <div className="share-footer">
                <span>{formatArabicDate(todayISO())}</span>
                <span>rassd.vercel.app</span>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* حاوية طباعة قائمة الأخطاء */}
      {listPrint &&
        createPortal(
          <div className="print-root">
            {listPrint.map((chunk, ci) => (
              <div key={ci} className="print-page">
                <div className="print-head">
                  <span>
                    📖 رصد — قائمة أخطاء {activeName ?? 'مصحفي'}
                    {errorFilter !== 'all' && ` (${ERROR_TYPES[errorFilter].label} فقط)`}
                  </span>
                  <span>{formatArabicDate(todayISO())}</span>
                </div>
                <div className="print-list-rows">
                  {chunk.map((e, i) =>
                    e.kind === 'date' ? (
                      <h4 key={i} className="error-list-date">
                        🗓️ {formatArabicDate(e.date)} — {arabicWordCount(e.count)}
                      </h4>
                    ) : (
                      (() => {
                        const [surah, ayah] = e.m.wordId.split(':');
                        const t = ERROR_TYPES[e.m.type];
                        return (
                          <div key={i} className="error-item">
                            <span
                              className="error-word"
                              style={{
                                background: t.bg,
                                boxShadow: `inset 0 -0.12em 0 0 ${t.color}`,
                              }}
                            >
                              {wordTexts.get(e.m.wordId) ?? ''}
                            </span>
                            <span className="error-meta">
                              <b>سورة {chapterMap.get(Number(surah))?.name ?? surah}</b> — آية{' '}
                              {toArabicDigits(ayah)}
                              <i className="error-type-tag" style={{ color: t.color }}>
                                {t.label}
                              </i>
                              {e.m.note && <span className="error-note">💬 {e.m.note}</span>}
                            </span>
                            <span className="error-meta-page">صفحة {toArabicDigits(e.m.page)}</span>
                          </div>
                        );
                      })()
                    )
                  )}
                </div>
                <div className="print-page-footer">
                  {toArabicDigits(ci + 1)} / {toArabicDigits(listPrint.length)}
                </div>
              </div>
            ))}
          </div>,
          document.body
        )}

      {/* حاوية الطباعة — خارج شجرة التطبيق (portal) حتى لا يخفيها إخفاء .app-root وقت الطباعة */}
      {printData &&
        createPortal(
          <div className="print-root">
            {printData.map((d) => (
              <div key={d.page} className="print-page">
                <div className="print-head">
                  <span>
                    📖 رصد — {activeName ? `متابعة تسميع ${activeName}` : 'متابعة أخطاء التسميع'}
                  </span>
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
          </div>,
          document.body
        )}
    </main>
  );
}
