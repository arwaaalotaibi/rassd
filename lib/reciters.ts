// كبار القرّاء من مصدرين مجانيين، كل معرّف مُتحقَّق منه فعلياً:
// - qcdn: verses.quran.com — ترقيم سورة+آية (001001.mp3)
// - islamic: cdn.islamic.network — ترقيم متسلسل للآيات (١..٦٢٣٦)
type ReciterSource = 'qcdn' | 'islamic';

export type Reciter = {
  id: string;
  name: string;
  source: ReciterSource;
  path: string;
};

export const RECITERS: Reciter[] = [
  { id: 'alafasy', name: 'مشاري العفاسي', source: 'qcdn', path: 'Alafasy' },
  { id: 'husary', name: 'محمود خليل الحصري — مرتّل', source: 'islamic', path: 'ar.husary' },
  { id: 'husary-mujawwad', name: 'محمود خليل الحصري — مجوّد', source: 'islamic', path: 'ar.husarymujawwad' },
  { id: 'abdulbaset', name: 'عبدالباسط عبدالصمد — مرتّل', source: 'qcdn', path: 'AbdulBaset/Murattal' },
  { id: 'abdulbaset-mujawwad', name: 'عبدالباسط عبدالصمد — مجوّد', source: 'qcdn', path: 'AbdulBaset/Mujawwad' },
  { id: 'minshawi', name: 'محمد صدّيق المنشاوي — مرتّل', source: 'qcdn', path: 'Minshawi/Murattal' },
  { id: 'minshawi-mujawwad', name: 'محمد صدّيق المنشاوي — مجوّد', source: 'qcdn', path: 'Minshawi/Mujawwad' },
  { id: 'sudais', name: 'عبدالرحمن السديس', source: 'qcdn', path: 'Sudais' },
  { id: 'shuraym', name: 'سعود الشريم', source: 'qcdn', path: 'Shuraym' },
  { id: 'muaiqly', name: 'ماهر المعيقلي', source: 'islamic', path: 'ar.mahermuaiqly' },
  { id: 'shatri', name: 'أبو بكر الشاطري', source: 'qcdn', path: 'Shatri' },
  { id: 'hudhaify', name: 'علي الحذيفي', source: 'islamic', path: 'ar.hudhaify' },
  { id: 'ayyoub', name: 'محمد أيوب', source: 'islamic', path: 'ar.muhammadayyoub' },
  { id: 'ajamy', name: 'أحمد العجمي', source: 'islamic', path: 'ar.ahmedajamy' },
  { id: 'rifai', name: 'هاني الرفاعي', source: 'qcdn', path: 'Rifai' },
  { id: 'jibreel', name: 'محمد جبريل', source: 'qcdn', path: 'Jibreel' },
];

export const DEFAULT_RECITER = 'alafasy';

// عدد آيات كل سورة (حفص — المجموع ٦٢٣٦) لحساب الترقيم المتسلسل
const VERSE_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
  54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60,
  49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19,
  26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
  6, 3, 5, 4, 5, 6,
];

const OFFSETS: number[] = [];
{
  let acc = 0;
  for (const c of VERSE_COUNTS) {
    OFFSETS.push(acc);
    acc += c;
  }
}

export function ayahAudioUrl(reciterId: string, surah: number, ayah: number): string {
  const r = RECITERS.find((x) => x.id === reciterId) ?? RECITERS[0];
  if (r.source === 'islamic') {
    const globalAyah = OFFSETS[surah - 1] + ayah;
    return `https://cdn.islamic.network/quran/audio/128/${r.path}/${globalAyah}.mp3`;
  }
  const pad = (n: number) => String(n).padStart(3, '0');
  return `https://verses.quran.com/${r.path}/mp3/${pad(surah)}${pad(ayah)}.mp3`;
}

export function loadReciter(): string {
  const saved = localStorage.getItem('rassd:reciter');
  return saved && RECITERS.some((r) => r.id === saved) ? saved : DEFAULT_RECITER;
}

export function saveReciter(id: string) {
  localStorage.setItem('rassd:reciter', id);
}
