export const DEFAULT_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <rect width="80" height="80" fill="#3a3b3d"/>
      <circle cx="40" cy="32" r="14" fill="#939597"/>
      <ellipse cx="40" cy="68" rx="22" ry="16" fill="#939597"/>
    </svg>`,
  )

function cover(hue, label) {
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="hsl(${hue} 35% 28%)"/>
            <stop offset="100%" stop-color="hsl(${hue + 40} 40% 18%)"/>
          </linearGradient>
        </defs>
        <rect width="200" height="200" fill="url(#g)"/>
        <text x="100" y="108" text-anchor="middle" fill="#f5df4d" font-size="22" font-family="sans-serif">${label}</text>
      </svg>`,
    )
  )
}

const SEED_VERSION = 2

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
    followers: [],
    following: [],
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
    followers: [],
    following: [],
    dailyStreams: 40,
    recentPlaylistIds: ['pl-2', 'pl-1', 'pl-4'],
  },
  {
    id: 'u-artist',
    email: 'artist@sepatify.test',
    password: 'password',
    displayName: 'هنرمند نمونه',
    username: 'user_artist',
    role: 'artist',
    artistName: 'هنرمند نمونه',
    subscription: 'basic',
    avatar: null,
    status: 'approved',
    followers: [],
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
    cover: cover(210, 'PL'),
  },
  {
    id: 'pl-2',
    title: 'تمرکز عمیق',
    ownerId: 'u-gold',
    cover: cover(160, 'PL'),
  },
  {
    id: 'pl-3',
    title: 'خالص الکترونیک',
    ownerId: 'u-listener',
    cover: cover(280, 'PL'),
  },
  {
    id: 'pl-4',
    title: 'جاده‌های باز',
    ownerId: 'u-gold',
    cover: cover(35, 'PL'),
  },
]

const SEED_ALBUMS = [
  {
    id: 'al-1',
    title: 'اقیانوس بی‌صدا',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover(200, 'AL'),
    releasedAt: '2026-06-01',
    earlyAccess: false,
  },
  {
    id: 'al-2',
    title: 'پژواک شهری',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover(320, 'AL'),
    releasedAt: '2026-06-20',
    earlyAccess: false,
  },
  {
    id: 'al-3',
    title: 'طلوع زرد',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover(50, 'AL'),
    releasedAt: '2026-07-10',
    earlyAccess: true,
  },
  {
    id: 'al-4',
    title: 'نیمه‌شب خاکستری',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    cover: cover(0, 'AL'),
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
    cover: cover(190, 'TR'),
    plays: 18240,
    earlyAccess: false,
  },
  {
    id: 'tr-2',
    title: 'پنجره نور',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-2',
    cover: cover(300, 'TR'),
    plays: 22100,
    earlyAccess: false,
  },
  {
    id: 'tr-3',
    title: 'گام‌های آهسته',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-1',
    cover: cover(145, 'TR'),
    plays: 15680,
    earlyAccess: false,
  },
  {
    id: 'tr-4',
    title: 'پیش‌نمایش طلایی',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-3',
    cover: cover(48, 'TR'),
    plays: 980,
    earlyAccess: true,
  },
  {
    id: 'tr-5',
    title: 'انحصاری سپتیفای',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: 'al-4',
    cover: cover(10, 'TR'),
    plays: 640,
    earlyAccess: true,
  },
  {
    id: 'tr-6',
    title: 'ریتم سرد',
    artistId: 'u-artist',
    artistName: 'هنرمند نمونه',
    albumId: null,
    cover: cover(220, 'TR'),
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
    const byEmail = new Map(existingUsers.map((u) => [u.email.toLowerCase(), u]))
    for (const seedUser of SEED_USERS) {
      if (!byEmail.has(seedUser.email.toLowerCase())) {
        existingUsers.push(seedUser)
      } else {
        const current = byEmail.get(seedUser.email.toLowerCase())
        if (!current.recentPlaylistIds?.length && seedUser.recentPlaylistIds?.length) {
          current.recentPlaylistIds = seedUser.recentPlaylistIds
        }
      }
    }
    storage.setItem('users', existingUsers)
  }

  storage.setItem('playlists', SEED_PLAYLISTS)
  storage.setItem('albums', SEED_ALBUMS)
  storage.setItem('tracks', SEED_TRACKS)
  storage.setItem('seeded', true)
  storage.setItem('seedVersion', SEED_VERSION)
}
