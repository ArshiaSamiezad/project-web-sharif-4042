export const DEFAULT_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <rect width="80" height="80" fill="#3a3b3d"/>
      <circle cx="40" cy="32" r="14" fill="#939597"/>
      <ellipse cx="40" cy="68" rx="22" ry="16" fill="#939597"/>
    </svg>`,
  )

function cover(id) {
  // Stable photo per id (picsum seed) — square album-style art.
  return `https://picsum.photos/seed/sepatify-${id}/400/400`
}

const SEED_VERSION = 5

const SEED_USERS = [
  {
    id: 'u-listener',
    email: 'listener@sepatify.test',
    password: 'password',
    displayName: 'شنونده نمونه',
    username: 'user_listen',
    role: 'listener',
    subscription: 'basic',
    avatar: null,
    birthDate: '2000-05-12',
    gender: 'female',
    followers: ['u-gold'],
    following: ['u-gold', 'u-artist'],
    dailyStreams: 12,
    recentPlaylistIds: ['pl-1', 'pl-2', 'pl-3'],
  },
  {
    id: 'u-gold',
    email: 'gold@sepatify.test',
    password: 'password',
    displayName: 'کاربر طلایی',
    username: 'user_gold',
    role: 'listener',
    subscription: 'gold',
    avatar: null,
    birthDate: '1998-11-03',
    gender: 'male',
    followers: ['u-listener', 'u-silver'],
    following: ['u-artist'],
    dailyStreams: 40,
    recentPlaylistIds: ['pl-2', 'pl-1', 'pl-4'],
  },
  {
    id: 'u-silver',
    email: 'silver@sepatify.test',
    password: 'password',
    displayName: 'کاربر نقره‌ای',
    username: 'user_silver',
    role: 'listener',
    subscription: 'silver',
    avatar: null,
    birthDate: '2001-02-20',
    gender: 'other',
    followers: [],
    following: ['u-gold'],
    dailyStreams: 18,
    recentPlaylistIds: ['pl-1'],
  },
  {
    id: 'u-artist',
    email: 'artist@sepatify.test',
    password: 'password',
    displayName: 'هنرمند نمونه',
    username: 'user_artist',
    role: 'artist',
    artistName: 'هنرمند نمونه',
    bio: 'هنرمند الکترونیک با تمرکز روی فضای شهری و بافت صوتی شبانه. از سال ۱۳۹۸ در حال انتشار تک‌آهنگ و آلبوم در سپتیفای است.',
    subscription: 'basic',
    avatar: null,
    status: 'approved',
    birthDate: null,
    gender: null,
    followers: ['u-listener', 'u-gold'],
    following: [],
    dailyStreams: 0,
    recentPlaylistIds: [],
  },
  {
    id: 'u-support',
    email: 'support@sepatify.test',
    password: 'password',
    displayName: 'پشتیبان',
    username: 'user_support',
    role: 'support',
    subscription: 'basic',
    avatar: null,
    birthDate: null,
    gender: null,
    followers: [],
    following: [],
    dailyStreams: 0,
    recentPlaylistIds: [],
  },
  {
    id: 'u-admin',
    email: 'admin@sepatify.test',
    password: 'password',
    displayName: 'مدیر سامانه',
    username: 'user_admin',
    role: 'admin',
    subscription: 'basic',
    avatar: null,
    birthDate: null,
    gender: null,
    followers: [],
    following: [],
    dailyStreams: 0,
    recentPlaylistIds: [],
  },
]

const SEED_PLAYLISTS = [
  {
    id: 'pl-1',
    title: 'شب‌های بارانی',
    ownerId: 'u-listener',
    cover: cover('pl-1'),
  },
  {
    id: 'pl-2',
    title: 'تمرکز عمیق',
    ownerId: 'u-gold',
    cover: cover('pl-2'),
  },
  {
    id: 'pl-3',
    title: 'خالص الکترونیک',
    ownerId: 'u-listener',
    cover: cover('pl-3'),
  },
  {
    id: 'pl-4',
    title: 'جاده‌های باز',
    ownerId: 'u-gold',
    cover: cover('pl-4'),
  },
]

const SEED_ALBUMS = [
  {
    id: 'al-1',
    title: 'اقیانوس بی‌صدا',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover('al-1'),
    releasedAt: '2026-06-01',
    earlyAccess: false,
  },
  {
    id: 'al-2',
    title: 'پژواک شهری',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover('al-2'),
    releasedAt: '2026-06-20',
    earlyAccess: false,
  },
  {
    id: 'al-3',
    title: 'طلوع زرد',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover('al-3'),
    releasedAt: '2026-07-10',
    earlyAccess: true,
  },
  {
    id: 'al-4',
    title: 'نیمه‌شب خاکستری',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover('al-4'),
    releasedAt: '2026-07-12',
    earlyAccess: true,
  },
]

const SEED_TRACKS = [
  {
    id: 'tr-1',
    title: 'موج اول',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-1',
    cover: cover('tr-1'),
    plays: 18240,
    earlyAccess: false,
  },
  {
    id: 'tr-2',
    title: 'پنجره نور',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-2',
    cover: cover('tr-2'),
    plays: 22100,
    earlyAccess: false,
  },
  {
    id: 'tr-3',
    title: 'گام‌های آهسته',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-1',
    cover: cover('tr-3'),
    plays: 15680,
    earlyAccess: false,
  },
  {
    id: 'tr-4',
    title: 'پیش‌نمایش طلایی',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-3',
    cover: cover('tr-4'),
    plays: 980,
    earlyAccess: true,
  },
  {
    id: 'tr-5',
    title: 'انحصاری سپتیفای',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-4',
    cover: cover('tr-5'),
    plays: 640,
    earlyAccess: true,
  },
  {
    id: 'tr-6',
    title: 'ریتم سرد',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: null,
    cover: cover('tr-6'),
    plays: 30120,
    earlyAccess: false,
  },
]

export function ensureSeedData(storage) {
  const version = storage.getItem('seedVersion', 0)
  if (version >= SEED_VERSION) return

  const existingUsers = storage.getItem('users', null)
  if (!existingUsers || existingUsers.length === 0) {
    storage.setItem('users', SEED_USERS)
  } else {
    const seedEmails = new Set(SEED_USERS.map((u) => u.email.toLowerCase()))
    const customUsers = existingUsers.filter((u) => !seedEmails.has(u.email.toLowerCase()))
    storage.setItem('users', [...SEED_USERS, ...customUsers])
  }

  storage.setItem('playlists', SEED_PLAYLISTS)
  storage.setItem('albums', SEED_ALBUMS)
  storage.setItem('tracks', SEED_TRACKS)
  storage.setItem('seeded', true)
  storage.setItem('seedVersion', SEED_VERSION)
}
