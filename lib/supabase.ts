// عميل Supabase: هوية ضيف عبر ترويسة x-device-id، أو حساب Google موثّق (auth.uid)
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { ErrorMark, ErrorType } from './errors';

export function getDeviceId(): string {
  let id = localStorage.getItem('rassd:device');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('rassd:device', id);
  }
  return id;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// اعتماد رمز مزامنة من جهاز آخر — يصير الجهازان حساباً واحداً (وضع الضيف)
export function adoptSyncCode(code: string): 'ok' | 'invalid' | 'same' {
  const v = code.trim().toLowerCase();
  if (!UUID_RE.test(v)) return 'invalid';
  if (v === getDeviceId().toLowerCase()) return 'same';
  localStorage.setItem('rassd:device', v);
  client = null; // إعادة إنشاء العميل بالترويسة الجديدة
  return 'ok';
}

// الهوية النشطة للترويسة: رمز الطالب عندما يكون ملفه نشطاً، وإلا هوية الجهاز.
// المستخدم المسجَّل يصل لصفوفه عبر توكن الجلسة (auth.uid) بغضّ النظر عن الترويسة.
let activeIdentity: string | null = null;

export function getIdentity(): string {
  return activeIdentity ?? getDeviceId();
}

export function setIdentity(id: string | null) {
  activeIdentity = id;
  client = null; // ترويسة x-device-id تتغيّر مع الهوية
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null; // لا عميل أثناء الرسم على الخادم
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      global: { headers: { 'x-device-id': getIdentity() } },
      // جلسة الحساب محفوظة ومشتركة بين نسخ العميل عبر نفس مفتاح التخزين
      auth: { persistSession: true, storageKey: 'rassd:auth' },
    });
  }
  return client;
}

// ————— حساب Google —————

export async function signInWithGoogle(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'المزامنة غير مفعّلة';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return error ? error.message : null;
}

// دخول برمز الإيميل: يُرسل رمز ٦ أرقام (ورابط دخول احتياطي) بلا كلمة مرور
export async function sendEmailOtp(email: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'المزامنة غير مفعّلة';
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
  });
  if (!error) return null;
  if (error.status === 429) return 'محاولات كثيرة — انتظر دقائق ثم أعد';
  return error.message;
}

export async function verifyEmailOtp(email: string, token: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'المزامنة غير مفعّلة';
  const { error } = await sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (!error) return null;
  if (error.message.toLowerCase().includes('expired')) return 'الرمز انتهت صلاحيته — أرسل رمزاً جديداً';
  return 'الرمز غير صحيح — تأكد منه وأعد';
}

export async function signOutAccount() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function getSessionUser(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

// ————— سجلّ جلسات التسميع —————

import type { SessionLog, SessionRating } from './sessions';

type LogRow = {
  id: string;
  device_id: string;
  date: string;
  surah: number;
  from_ayah: number;
  to_ayah: number;
  rating: SessionRating;
  created_at: string;
};

function rowToLog(r: LogRow): SessionLog {
  return {
    id: r.id,
    date: r.date,
    surah: r.surah,
    fromAyah: r.from_ayah,
    toAyah: r.to_ayah,
    rating: r.rating,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function fetchRemoteLogs(identity: string): Promise<SessionLog[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('session_logs')
    .select('*')
    .eq('device_id', identity);
  if (error) return null;
  return (data as LogRow[]).map(rowToLog);
}

export async function pushLogs(identity: string, logs: SessionLog[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || logs.length === 0) return !!sb;
  const rows = logs.map((l) => ({
    id: l.id,
    device_id: identity,
    date: l.date,
    surah: l.surah,
    from_ayah: l.fromAyah,
    to_ayah: l.toAyah,
    rating: l.rating,
    created_at: new Date(l.createdAt).toISOString(),
  }));
  const { error } = await sb.from('session_logs').upsert(rows, { onConflict: 'id' });
  return !error;
}

export async function deleteRemoteLog(identity: string, id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from('session_logs')
    .delete()
    .eq('device_id', identity)
    .eq('id', id);
  return !error;
}

// ————— روابط المعلّم والطالب (للحسابات المسجَّلة) —————

export type TeacherLink = {
  student_id: string;
  teacher_id: string;
  student_name: string;
  teacher_label: string;
};

// (جهة الطالب) معلّميّ المرتبطون بي
export async function fetchMyTeachers(): Promise<TeacherLink[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return [];
  const { data, error } = await sb
    .from('teacher_links')
    .select('*')
    .eq('student_id', uid);
  return error ? [] : (data as TeacherLink[]);
}

// (جهة الطالب) إضافة معلّم برمزه
export async function addTeacherLink(
  teacherCode: string,
  myName: string,
  teacherLabel: string
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'المزامنة غير مفعّلة';
  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return 'سجّل الدخول أولاً';
  const code = teacherCode.trim().toLowerCase();
  if (!UUID_RE.test(code)) return 'رمز المعلّم غير صحيح';
  if (code === uid) return 'هذا رمزك أنت وليس رمز المعلّم';
  const { error } = await sb.from('teacher_links').insert({
    student_id: uid,
    teacher_id: code,
    student_name: myName,
    teacher_label: teacherLabel,
  });
  if (error) {
    return error.code === '23505' ? 'هذا المعلّم مرتبط بك من قبل' : 'تعذّر الربط — جرّب مرة أخرى';
  }
  return null;
}

// (الطرفان) فكّ الارتباط
export async function removeTeacherLink(studentId: string, teacherId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from('teacher_links')
    .delete()
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId);
  return !error;
}

// (جهة المعلّم) طلابي المرتبطون بي عبر حساباتهم
export async function fetchMyLinkedStudents(): Promise<TeacherLink[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: session } = await sb.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return [];
  const { data, error } = await sb
    .from('teacher_links')
    .select('*')
    .eq('teacher_id', uid)
    .order('created_at');
  return error ? [] : (data as TeacherLink[]);
}

// ————— بيانات العلامات —————

type Row = {
  device_id: string;
  word_id: string;
  page: number;
  type: ErrorType;
  date: string;
  created_at: string;
  note?: string;
};

function rowToMark(r: Row): ErrorMark {
  return {
    id: `${r.word_id}@${r.date}`,
    wordId: r.word_id,
    page: r.page,
    type: r.type,
    date: r.date,
    createdAt: new Date(r.created_at).getTime(),
    note: r.note ?? '',
  };
}

// جلب رصد أي رمز (لاستيراد رصد قديم إلى حساب): عميل مؤقت بترويسة الرمز نفسه
export async function fetchMarksByCode(code: string): Promise<ErrorMark[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const temp = createClient(url, key, {
    global: { headers: { 'x-device-id': code } },
    auth: { persistSession: false },
  });
  const { data, error } = await temp.from('error_marks').select('*').eq('device_id', code);
  if (error) return null;
  return (data as Row[]).map(rowToMark);
}

export async function fetchRemoteMarks(identity: string): Promise<ErrorMark[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('error_marks')
    .select('*')
    .eq('device_id', identity);
  if (error) return null;
  return (data as Row[]).map(rowToMark);
}

export async function pushMarks(identity: string, marks: ErrorMark[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || marks.length === 0) return !!sb;
  const rows = marks.map((m) => ({
    device_id: identity,
    word_id: m.wordId,
    page: m.page,
    type: m.type,
    date: m.date,
    created_at: new Date(m.createdAt).toISOString(),
    note: m.note ?? '',
  }));
  const { error } = await sb
    .from('error_marks')
    .upsert(rows, { onConflict: 'device_id,word_id,date' });
  return !error;
}

export async function deleteRemoteMarks(
  identity: string,
  wordId: string,
  date?: string
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  let q = sb
    .from('error_marks')
    .delete()
    .eq('device_id', identity)
    .eq('word_id', wordId);
  if (date) q = q.eq('date', date);
  const { error } = await q;
  return !error;
}
