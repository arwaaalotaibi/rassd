// عميل Supabase مع معرّف جهاز ثابت — كل جهاز يرى علاماته فقط (RLS عبر ترويسة x-device-id)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

// اعتماد رمز مزامنة من جهاز آخر — يصير الجهازان حساباً واحداً
export function adoptSyncCode(code: string): 'ok' | 'invalid' | 'same' {
  const v = code.trim().toLowerCase();
  if (!UUID_RE.test(v)) return 'invalid';
  if (v === getDeviceId().toLowerCase()) return 'same';
  localStorage.setItem('rassd:device', v);
  client = null; // إعادة إنشاء العميل بالترويسة الجديدة
  return 'ok';
}

// الهوية النشطة: هوية صاحب الجهاز، أو رمز الطالب عندما يكون ملفه نشطاً —
// كل عمليات القراءة والكتابة السحابية تمرّ بها
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
      auth: { persistSession: false },
    });
  }
  return client;
}

type Row = {
  device_id: string;
  word_id: string;
  page: number;
  type: ErrorType;
  date: string;
  created_at: string;
};

function rowToMark(r: Row): ErrorMark {
  return {
    id: `${r.word_id}@${r.date}`,
    wordId: r.word_id,
    page: r.page,
    type: r.type,
    date: r.date,
    createdAt: new Date(r.created_at).getTime(),
  };
}

export async function fetchRemoteMarks(): Promise<ErrorMark[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('error_marks')
    .select('*')
    .eq('device_id', getIdentity());
  if (error) return null;
  return (data as Row[]).map(rowToMark);
}

export async function pushMarks(marks: ErrorMark[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || marks.length === 0) return !!sb;
  const rows = marks.map((m) => ({
    device_id: getIdentity(),
    word_id: m.wordId,
    page: m.page,
    type: m.type,
    date: m.date,
    created_at: new Date(m.createdAt).toISOString(),
  }));
  const { error } = await sb
    .from('error_marks')
    .upsert(rows, { onConflict: 'device_id,word_id,date' });
  return !error;
}

export async function deleteRemoteMarks(wordId: string, date?: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  let q = sb
    .from('error_marks')
    .delete()
    .eq('device_id', getIdentity())
    .eq('word_id', wordId);
  if (date) q = q.eq('date', date);
  const { error } = await q;
  return !error;
}
