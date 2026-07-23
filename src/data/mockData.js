// Developer: Person 1 (Music Player Architect)
// این فایل یک لایه سازگاری (compatibility layer) است که آرایه `songs` مورد نیاز
// پلیر موسیقی (useAudioPlayer, QueueList) را از داده واقعی ذخیره‌شده در storage
// (که توسط src/data/seed.js مقداردهی اولیه می‌شود) استخراج می‌کند.
//
// نکته مهم: در محیط تست (Vitest/jsdom) ممکن است localStorage خالی باشد یا
// ensureSeedData هنوز اجرا نشده باشد؛ به همین دلیل در صورت نبود داده، بدون خطا
// یک آرایه خالی برگردانده می‌شود.
import * as storage from '../lib/storage'

function readTracks() {
  try {
    const tracks = storage.getItem('tracks', [])
    if (!Array.isArray(tracks)) return []
    return tracks
  } catch {
    return []
  }
}

function toSong(track) {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artistName,
    coverImage: track.coverImage || track.cover,
    audioUrl: track.audioUrl,
  }
}

// آرایه‌ای زنده از آهنگ‌ها بر اساس تراک‌های ذخیره‌شده در storage.
// چون در حالت واقعی برنامه، storage در main.jsx/AuthProvider مقداردهی می‌شود،
// این export هر بار که ماژول import می‌شود مقدار به‌روز را می‌خواند.
export const songs = readTracks().map(toSong)
