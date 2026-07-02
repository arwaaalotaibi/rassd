// ملفات الطلاب: المعلّم يضيف طالباً باسمه ورمزه، والرمز هو هوية الطالب نفسها في البرنامج —
// فكل رصد يسجَّل وهو ملف الطالب نشط يُكتب في حساب الطالب مباشرة ويظهر عنده تلقائياً

export type StudentProfile = {
  id: string; // رمز الطالب (uuid) — نفس هويته في جهازه
  name: string;
};

const STUDENTS_KEY = 'rassd:students';
const ACTIVE_KEY = 'rassd:activeStudent';

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadStudents(): StudentProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STUDENTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStudents(students: StudentProfile[]) {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
}

// الملف النشط: null = «أنا» (مصحف صاحب الجهاز)
export function loadActiveStudent(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveStudent(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}
