export const DEFAULT_AVATAR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
      <rect width="80" height="80" fill="#2a241f"/>
      <circle cx="40" cy="32" r="14" fill="#8a7a6b"/>
      <ellipse cx="40" cy="68" rx="22" ry="16" fill="#8a7a6b"/>
    </svg>`,
  )

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
    recentPlaylistIds: [],
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
    recentPlaylistIds: [],
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

export function ensureSeedData(storage) {
  if (storage.getItem('seeded')) return
  storage.setItem('users', SEED_USERS)
  storage.setItem('playlists', [])
  storage.setItem('albums', [])
  storage.setItem('tracks', [])
  storage.setItem('seeded', true)
}
