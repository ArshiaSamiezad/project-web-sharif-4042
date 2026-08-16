import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import PlayingBars from '../components/PlayingBars'
import './ProfilePage.css'

const GENDER_LABELS = {
  female: 'زن',
  male: 'مرد',
  other: 'سایر',
  unspecified: 'ترجیح می‌دهم نگویم',
}

function subscriptionLabel(type) {
  switch (type) {
    case 'gold':
      return 'طلایی'
    case 'silver':
      return 'نقره‌ای'
    default:
      return 'عادی (پایه)'
  }
}

function canChangeAvatar(subscription) {
  return subscription === 'gold' || subscription === 'silver'
}

export default function ProfilePage() {
  const { username: usernameParam } = useParams()
  const navigate = useNavigate()
  const {
    currentUser,
    getUserById,
    getUserByUsername,
    isUsernameTaken,
    updateUser,
    toggleFollow,
    getCatalog,
    defaultAvatar,
  } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()

  const profile = usernameParam ? getUserByUsername(usernameParam) : currentUser
  const isOwn = Boolean(profile && profile.id === currentUser.id)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [, setTick] = useState(0)

  function refresh() {
    setTick((n) => n + 1)
  }

  useEffect(() => {
    setEditing(null)
    setMessage('')
    setError('')
    setUsernameError('')
  }, [usernameParam])

  if (!profile) {
    return (
      <div className="profile">
        <p className="profile__error">کاربر پیدا نشد.</p>
        <Link to="/profile">بازگشت به نمایه من</Link>
      </div>
    )
  }

  const liveProfile = getUserById(profile.id) || profile
  const isFollowing = currentUser.following?.includes(liveProfile.id)
  const avatarEditable = isOwn && canChangeAvatar(currentUser.subscription)
  const isArtist = liveProfile.role === 'artist'
  const isVerifiedArtist = isArtist && liveProfile.status === 'approved'
  const viewerIsGold = currentUser.subscription === 'gold'
  const catalog = getCatalog()
  const artistAlbums = isArtist
    ? catalog.albums.filter(
        (a) => a.artistId === liveProfile.id && (viewerIsGold || !a.earlyAccess),
      )
    : []
  const artistSingles = isArtist
    ? catalog.tracks.filter(
        (t) =>
          t.artistId === liveProfile.id &&
          !t.albumId &&
          (viewerIsGold || !t.earlyAccess),
      )
    : []
  const artistTracks = isArtist
    ? catalog.tracks.filter((t) => t.artistId === liveProfile.id)
    : []
  const totalStreams = artistTracks.reduce((sum, t) => sum + (t.plays || 0), 0)
  const totalListeners = liveProfile.followers?.length ?? 0

  function applyUpdate(result, { forUsername = false } = {}) {
    if (!result.ok) {
      const text = result.error || 'ذخیره انجام نشد.'
      if (forUsername) setUsernameError(text)
      else setError(text)
      return false
    }
    refresh()
    return true
  }

  function startEdit(field) {
    setError('')
    setUsernameError('')
    setMessage('')
    setEditing(field)
    if (field === 'personal') {
      setDraft({
        displayName: liveProfile.displayName || '',
        birthDate: liveProfile.birthDate || '',
        gender: liveProfile.gender || '',
      })
    } else if (field === 'username') {
      setDraft({ username: liveProfile.username || '' })
    } else if (field === 'subscription') {
      setDraft({ subscription: liveProfile.subscription || 'basic' })
    } else if (field === 'dailyStreams') {
      setDraft({ dailyStreams: String(liveProfile.dailyStreams ?? 0) })
    } else if (field === 'avatar') {
      setDraft({ avatar: liveProfile.avatar || '' })
    } else if (field === 'bio') {
      setDraft({ bio: liveProfile.bio || '' })
    }
  }

  function cancelEdit() {
    setEditing(null)
    setDraft({})
    setError('')
    setUsernameError('')
  }

  async function saveEdit(e) {
    e.preventDefault()
    setError('')
    setUsernameError('')

    if (editing === 'personal') {
      if (!draft.displayName.trim()) {
        setError('نام نمایشی نمی‌تواند خالی باشد.')
        return
      }
      if (
        !applyUpdate(
          await updateUser(liveProfile.id, {
            displayName: draft.displayName.trim(),
            birthDate: draft.birthDate || null,
            gender: draft.gender || null,
          }),
        )
      ) {
        return
      }
      setMessage('اطلاعات شخصی ذخیره شد.')
    }

    if (editing === 'username') {
      const username = draft.username.trim()
      if (!username) {
        setUsernameError('نام کاربری نمی‌تواند خالی باشد.')
        return
      }
      if (!/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
        setUsernameError('نام کاربری باید ۳ تا ۲۰ کاراکتر انگلیسی/عدد/نقطه/زیرخط باشد.')
        return
      }
      if (isUsernameTaken(username, liveProfile.id)) {
        setUsernameError('این نام کاربری قبلاً استفاده شده است.')
        return
      }
      if (!applyUpdate(await updateUser(liveProfile.id, { username }), { forUsername: true })) {
        return
      }
      setMessage('نام کاربری ذخیره شد.')
      if (usernameParam) {
        navigate(`/profile/${username}`, { replace: true })
      }
    }
    if (editing === 'subscription') {
      if (!applyUpdate(await updateUser(liveProfile.id, { subscription: draft.subscription }))) {
        return
      }
      setMessage('نوع اشتراک به‌روز شد.')
    }

    if (editing === 'dailyStreams') {
      const value = Number(draft.dailyStreams)
      if (!Number.isFinite(value) || value < 0) {
        setError('عدد استریم روزانه معتبر نیست.')
        return
      }
      if (!applyUpdate(await updateUser(liveProfile.id, { dailyStreams: Math.floor(value) }))) {
        return
      }
      setMessage('آمار استریم روزانه ذخیره شد.')
    }

    if (editing === 'avatar') {
      if (!canChangeAvatar(currentUser.subscription)) {
        setError('با اشتراک پایه امکان تغییر عکس پروفایل وجود ندارد.')
        return
      }
      if (
        !applyUpdate(
          await updateUser(liveProfile.id, {
            avatar: draft.avatar.trim() || null,
          }),
        )
      ) {
        return
      }
      setMessage('عکس پروفایل ذخیره شد.')
    }

    if (editing === 'bio') {
      if (
        !applyUpdate(
          await updateUser(liveProfile.id, {
            bio: draft.bio.trim(),
          }),
        )
      ) {
        return
      }
      setMessage('بیوگرافی ذخیره شد.')
    }

    setEditing(null)
    setDraft({})
  }

  function handleAvatarFile(file) {
    if (!file) return
    if (!canChangeAvatar(currentUser.subscription)) {
      setError('با اشتراک پایه امکان آپلود عکس پروفایل وجود ندارد.')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      if (!applyUpdate(await updateUser(liveProfile.id, { avatar: String(reader.result) }))) {
        return
      }
      setMessage('عکس پروفایل آپلود شد.')
      setEditing(null)
    }
    reader.readAsDataURL(file)
  }

  function handleFollow() {
    const result = toggleFollow(liveProfile.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    refresh()
    setMessage(result.following ? 'این کاربر را دنبال کردید.' : 'دنبال کردن لغو شد.')
  }

  return (
    <div className="profile">
      <header className="profile__hero">
        <img
          className="profile__avatar"
          src={liveProfile.avatar || defaultAvatar}
          alt=""
          width={112}
          height={112}
        />
        <div className="profile__hero-text">
          <h1 className="profile__title">
            <span>{liveProfile.artistName || liveProfile.displayName}</span>
            {isVerifiedArtist ? (
              <span className="profile__verified" title="هنرمند تأییدشده">
                نشان هنرمند تأییدشده
              </span>
            ) : null}
          </h1>
          <p className="profile__username" dir="ltr">
            @{liveProfile.username}
          </p>
          {isArtist && liveProfile.status === 'pending' ? (
            <span className="profile__plan">در انتظار تأیید</span>
          ) : (
            <span className={`profile__plan profile__plan--${liveProfile.subscription || 'basic'}`}>
              {subscriptionLabel(liveProfile.subscription)}
            </span>
          )}
        </div>
        <div className="profile__hero-actions">
          {!isOwn ? (
            <button type="button" className="profile__btn" onClick={handleFollow}>
              {isFollowing ? 'لغو دنبال کردن' : 'دنبال کردن'}
            </button>
          ) : null}
        </div>
      </header>

      {message ? (
        <p className="profile__ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="profile__error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="profile__stats" aria-label="آمار">
        <div>
          <strong>{liveProfile.followers?.length ?? 0}</strong>
          <span>فالوور</span>
        </div>
        <div>
          <strong>{liveProfile.following?.length ?? 0}</strong>
          <span>فالویینگ</span>
        </div>
        <div>
          <strong>{liveProfile.dailyStreams ?? 0}</strong>
          <span>استریم امروز</span>
        </div>
      </section>

      {isArtist ? (
        <>
          <section className="profile__card">
            <div className="profile__card-head">
              <h2>بیوگرافی</h2>
              {isOwn && editing !== 'bio' ? (
                <button type="button" className="profile__link-btn" onClick={() => startEdit('bio')}>
                  ویرایش
                </button>
              ) : null}
            </div>
            {editing === 'bio' ? (
              <form className="profile__form" onSubmit={saveEdit}>
                <label className="profile__form-span">
                  متن بیوگرافی
                  <textarea
                    rows={4}
                    value={draft.bio}
                    onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                  />
                </label>
                <div className="profile__form-actions">
                  <button type="submit" className="profile__btn">
                    ذخیره
                  </button>
                  <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                    انصراف
                  </button>
                </div>
              </form>
            ) : (
              <p className="profile__hint">{liveProfile.bio || 'بیوگرافی ثبت نشده است.'}</p>
            )}
          </section>

          {viewerIsGold ? (
            <section className="profile__card profile__card--gold-stats">
              <div className="profile__card-head">
                <h2>آمار کلی (ویژه طلایی)</h2>
              </div>
              <div className="profile__stats profile__stats--nested">
                <div>
                  <strong>{totalListeners.toLocaleString('fa-IR')}</strong>
                  <span>شنوندگان</span>
                </div>
                <div>
                  <strong>{totalStreams.toLocaleString('fa-IR')}</strong>
                  <span>مجموع استریم‌ها</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="profile__card">
            <div className="profile__card-head">
              <h2>آلبوم‌ها</h2>
            </div>
            {artistAlbums.length === 0 ? (
              <p className="profile__hint">هنوز آلبومی منتشر نشده است.</p>
            ) : (
              <div className="profile__releases">
                {artistAlbums.map((album) => (
                  <article key={album.id} className="profile__release">
                    <button
                      type="button"
                      className="profile__release-cover"
                      onClick={() => navigate(`/album/${album.id}`)}
                      aria-label={`باز کردن آلبوم ${album.title}`}
                    >
                      <img src={album.cover} alt="" />
                    </button>
                    <button
                      type="button"
                      className="profile__release-title"
                      onClick={() => navigate(`/album/${album.id}`)}
                    >
                      {album.title}
                    </button>
                    <p>{(album.listeners || 0).toLocaleString('fa-IR')} شنونده</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="profile__card">
            <div className="profile__card-head">
              <h2>تک‌آهنگ‌ها</h2>
            </div>
            {artistSingles.length === 0 ? (
              <p className="profile__hint">هنوز تک‌آهنگی منتشر نشده است.</p>
            ) : (
              <div className="profile__releases">
                {artistSingles.map((track) => {
                  const isPlaying = playingTrackId === track.id
                  return (
                    <article
                      key={track.id}
                      className={`profile__release${isPlaying ? ' is-playing' : ''}`}
                    >
                      <button
                        type="button"
                        className="profile__release-cover"
                        onClick={() => playTrack(track.id)}
                        aria-label={isPlaying ? `توقف ${track.title}` : `پخش ${track.title}`}
                      >
                        <img src={track.cover} alt="" />
                        {isPlaying ? (
                          <span className="profile__playing">
                            <PlayingBars />
                            <span>در حال پخش</span>
                          </span>
                        ) : (
                          <span className="profile__play-hint" aria-hidden="true">
                            ▶
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="profile__release-title"
                        onClick={() => playTrack(track.id)}
                      >
                        {track.title}
                      </button>
                      <p>{(track.listeners || track.plays || 0).toLocaleString('fa-IR')} شنونده</p>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>اطلاعات شخصی</h2>
          {isOwn && editing !== 'personal' ? (
            <button type="button" className="profile__link-btn" onClick={() => startEdit('personal')}>
              ویرایش
            </button>
          ) : null}
        </div>
        {editing === 'personal' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              نام نمایشی
              <input
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
              />
            </label>
            <label>
              تاریخ تولد
              <input
                type="date"
                dir="ltr"
                value={draft.birthDate}
                onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
              />
            </label>
            <label>
              جنسیت
              <select
                value={draft.gender}
                onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
              >
                <option value="">انتخاب کنید</option>
                <option value="female">زن</option>
                <option value="male">مرد</option>
                <option value="other">سایر</option>
                <option value="unspecified">ترجیح می‌دهم نگویم</option>
              </select>
            </label>
            <div className="profile__form-actions">
              <button type="submit" className="profile__btn">
                ذخیره
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                انصراف
              </button>
            </div>
          </form>
        ) : (
          <dl className="profile__dl">
            <div>
              <dt>نام نمایشی</dt>
              <dd>{liveProfile.displayName}</dd>
            </div>
            <div>
              <dt>تاریخ تولد</dt>
              <dd dir="ltr">{liveProfile.birthDate || '—'}</dd>
            </div>
            <div>
              <dt>جنسیت</dt>
              <dd>{GENDER_LABELS[liveProfile.gender] || '—'}</dd>
            </div>
            <div>
              <dt>ایمیل</dt>
              <dd dir="ltr">{liveProfile.email}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>نام کاربری سامانه</h2>
          {isOwn && editing !== 'username' ? (
            <button type="button" className="profile__link-btn" onClick={() => startEdit('username')}>
              ویرایش
            </button>
          ) : null}
        </div>
        {editing === 'username' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              نام کاربری
              <input
                dir="ltr"
                value={draft.username}
                onChange={(e) => {
                  setUsernameError('')
                  setDraft((d) => ({ ...d, username: e.target.value }))
                }}
              />
            </label>
            {usernameError ? (
              <p className="profile__error" role="alert">
                {usernameError}
              </p>
            ) : null}
            <div className="profile__form-actions">
              <button type="submit" className="profile__btn">
                ذخیره
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                انصراف
              </button>
            </div>
          </form>
        ) : (
          <p className="profile__value" dir="ltr">
            @{liveProfile.username}
          </p>
        )}
      </section>

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>عکس پروفایل</h2>
          {isOwn && editing !== 'avatar' ? (
            <button type="button" className="profile__link-btn" onClick={() => startEdit('avatar')}>
              ویرایش
            </button>
          ) : null}
        </div>
        {editing === 'avatar' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            {avatarEditable ? (
              <>
                <label>
                  آپلود تصویر
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                  />
                </label>
                <label>
                  یا نشانی تصویر
                  <input
                    dir="ltr"
                    placeholder="https://..."
                    value={draft.avatar}
                    onChange={(e) => setDraft((d) => ({ ...d, avatar: e.target.value }))}
                  />
                </label>
                <div className="profile__form-actions">
                  <button type="submit" className="profile__btn">
                    ذخیره نشانی
                  </button>
                  <button
                    type="button"
                    className="profile__btn profile__btn--ghost"
                    onClick={async () => {
                      if (applyUpdate(await updateUser(liveProfile.id, { avatar: '' }))) {
                        setMessage('عکس پروفایل به پیش‌فرض برگشت.')
                        cancelEdit()
                      }
                    }}
                  >
                    حذف عکس
                  </button>
                  <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                    انصراف
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="profile__hint">
                  با اشتراک پایه امکان آپلود و تغییر عکس پروفایل وجود ندارد. برای تغییر عکس، اشتراک را به
                  نقره‌ای یا طلایی ارتقا دهید.
                </p>
                <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                  بستن
                </button>
              </>
            )}
          </form>
        ) : (
          <p className="profile__hint">
            {liveProfile.avatar
              ? 'عکس اختصاصی تنظیم شده است.'
              : 'از عکس پیش‌فرض سامانه استفاده می‌شود.'}
            {!canChangeAvatar(liveProfile.subscription) && isOwn
              ? ' (اشتراک پایه: تغییر عکس غیرفعال است)'
              : ''}
          </p>
        )}
      </section>

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>نوع اشتراک</h2>
          {isOwn && editing !== 'subscription' ? (
            <button
              type="button"
              className="profile__link-btn"
              onClick={() => startEdit('subscription')}
            >
              ویرایش
            </button>
          ) : null}
        </div>
        {editing === 'subscription' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              اشتراک
              <select
                value={draft.subscription}
                onChange={(e) => setDraft((d) => ({ ...d, subscription: e.target.value }))}
              >
                <option value="basic">عادی (پایه)</option>
                <option value="silver">نقره‌ای</option>
                <option value="gold">طلایی</option>
              </select>
            </label>
            <div className="profile__form-actions">
              <button type="submit" className="profile__btn">
                ذخیره
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                انصراف
              </button>
            </div>
          </form>
        ) : (
          <p className="profile__value">{subscriptionLabel(liveProfile.subscription)}</p>
        )}
      </section>

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>آمار استریم روزانه</h2>
          {isOwn && editing !== 'dailyStreams' ? (
            <button
              type="button"
              className="profile__link-btn"
              onClick={() => startEdit('dailyStreams')}
            >
              ویرایش
            </button>
          ) : null}
        </div>
        {editing === 'dailyStreams' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              تعداد استریم امروز
              <input
                type="number"
                min="0"
                dir="ltr"
                value={draft.dailyStreams}
                onChange={(e) => setDraft((d) => ({ ...d, dailyStreams: e.target.value }))}
              />
            </label>
            <div className="profile__form-actions">
              <button type="submit" className="profile__btn">
                ذخیره
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                انصراف
              </button>
            </div>
          </form>
        ) : (
          <p className="profile__value">{liveProfile.dailyStreams ?? 0}</p>
        )}
      </section>

      {isOwn ? (
        <section className="profile__card">
          <div className="profile__card-head">
            <h2>نمایه‌های دیگر (برای تست دنبال کردن)</h2>
          </div>
          <ul className="profile__people">
            {['u-listener', 'u-gold', 'u-silver', 'u-artist']
              .filter((id) => id !== currentUser.id)
              .map((id) => {
                const u = getUserById(id)
                if (!u) return null
                return (
                  <li key={id}>
                    <Link to={`/profile/${u.username}`}>{u.displayName}</Link>
                    <span dir="ltr"> (@{u.username})</span>
                  </li>
                )
              })}
          </ul>
        </section>
      ) : (
        <p className="profile__back">
          <Link to="/profile">بازگشت به نمایه من</Link>
        </p>
      )}
    </div>
  )
}
