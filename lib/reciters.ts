// كبار القرّاء المتوفرون على CDN تلاوات quran.com — كل معرّف مُتحقَّق منه فعلياً
export const RECITERS = [
  { id: 'Alafasy', name: 'مشاري العفاسي' },
  { id: 'AbdulBaset/Murattal', name: 'عبدالباسط عبدالصمد — مرتّل' },
  { id: 'AbdulBaset/Mujawwad', name: 'عبدالباسط عبدالصمد — مجوّد' },
  { id: 'Minshawi/Murattal', name: 'محمد صدّيق المنشاوي — مرتّل' },
  { id: 'Minshawi/Mujawwad', name: 'محمد صدّيق المنشاوي — مجوّد' },
  { id: 'Sudais', name: 'عبدالرحمن السديس' },
  { id: 'Shuraym', name: 'سعود الشريم' },
  { id: 'Shatri', name: 'أبو بكر الشاطري' },
  { id: 'Rifai', name: 'هاني الرفاعي' },
  { id: 'Jibreel', name: 'محمد جبريل' },
] as const;

export const DEFAULT_RECITER = 'Alafasy';

export function ayahAudioUrl(reciter: string, surah: number, ayah: number): string {
  const pad = (n: number) => String(n).padStart(3, '0');
  return `https://verses.quran.com/${reciter}/mp3/${pad(surah)}${pad(ayah)}.mp3`;
}

export function loadReciter(): string {
  const saved = localStorage.getItem('rassd:reciter');
  return saved && RECITERS.some((r) => r.id === saved) ? saved : DEFAULT_RECITER;
}

export function saveReciter(id: string) {
  localStorage.setItem('rassd:reciter', id);
}
