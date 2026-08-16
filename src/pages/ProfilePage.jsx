import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import { useI18n } from '../i18n/I18nProvider'
import PlayingBars from '../components/PlayingBars'
import './ProfilePage.css'

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
  const { t, formatNumber, subscriptionLabel, genderLabel, language } = useI18n()

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
        <p className="profile__error">{t('profile.notFound')}</p>
        <Link to="/profile">{t('profile.backToMine')}</Link>
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
        (track) =>
          track.artistId === liveProfile.id &&
          !track.albumId &&
          (viewerIsGold || !track.earlyAccess),
      )
    : []
  const artistTracks = isArtist
    ? catalog.tracks.filter((tr) => tr.artistId === liveProfile.id)
    : []
  const totalStreams = artistTracks.reduce((sum, tr) => sum + (tr.plays || 0), 0)
  const totalListeners = liveProfile.followers?.length ?? 0

  function applyUpdate(result, { forUsername = false } = {}) {
    if (!result.ok) {
      const text = result.error || t('profile.saveFailed')
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
        setError(t('profile.displayNameRequired'))
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
      setMessage(t('profile.saved'))
    }

    if (editing === 'username') {
      const username = draft.username.trim()
      if (!username) {
        setUsernameError(t('profile.usernameRequired'))
        return
      }
      if (!/^[a-zA-Z0-9._]{3,20}$/.test(username)) {
        setUsernameError(t('profile.usernameInvalid'))
        return
      }
      if (isUsernameTaken(username, liveProfile.id)) {
        setUsernameError(t('errors.usernameTaken'))
        return
      }
      if (!applyUpdate(await updateUser(liveProfile.id, { username }), { forUsername: true })) {
        return
      }
      setMessage(t('profile.saved'))
      if (usernameParam) {
        navigate(`/profile/${username}`, { replace: true })
      }
    }
    if (editing === 'subscription') {
      if (!applyUpdate(await updateUser(liveProfile.id, { subscription: draft.subscription }))) {
        return
      }
      setMessage(t('profile.saved'))
    }

    if (editing === 'dailyStreams') {
      const value = Number(draft.dailyStreams)
      if (!Number.isFinite(value) || value < 0) {
        setError(t('profile.dailyStreamsInvalid'))
        return
      }
      if (!applyUpdate(await updateUser(liveProfile.id, { dailyStreams: Math.floor(value) }))) {
        return
      }
      setMessage(t('profile.saved'))
    }

    if (editing === 'avatar') {
      if (!canChangeAvatar(currentUser.subscription)) {
        setError(t('profile.avatarBlocked'))
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
      setMessage(t('profile.saved'))
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
      setMessage(t('profile.saved'))
    }

    setEditing(null)
    setDraft({})
  }

  function handleAvatarFile(file) {
    if (!file) return
    if (!canChangeAvatar(currentUser.subscription)) {
      setError(t('profile.avatarBlocked'))
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      if (!applyUpdate(await updateUser(liveProfile.id, { avatar: String(reader.result) }))) {
        return
      }
      setMessage(t('profile.saved'))
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
    setMessage(result.following ? t('profile.followOk') : t('profile.unfollowOk'))
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
              <span className="profile__verified" title={t('profile.verifiedTitle')}>
                {t('profile.verified')}
              </span>
            ) : null}
          </h1>
          <p className="profile__username" dir="ltr">
            @{liveProfile.username}
          </p>
          {isArtist && liveProfile.status === 'pending' ? (
            <span className="profile__plan">{t('profile.pending')}</span>
          ) : (
            <span className={`profile__plan profile__plan--${liveProfile.subscription || 'basic'}`}>
              {subscriptionLabel(liveProfile.subscription)}
            </span>
          )}
        </div>
        <div className="profile__hero-actions">
          {isOwn && isVerifiedArtist ? (
            <Link to="/artist/works" className="profile__btn">
              {t('profile.manageWorks')}
            </Link>
          ) : null}
          {!isOwn ? (
            <button type="button" className="profile__btn" onClick={handleFollow}>
              {isFollowing ? t('profile.unfollow') : t('profile.follow')}
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

      <section className="profile__stats" aria-label={t('profile.statsAria')}>
        <div>
          <strong>{formatNumber(liveProfile.followers?.length ?? 0)}</strong>
          <span>{t('profile.followers')}</span>
        </div>
        <div>
          <strong>{formatNumber(liveProfile.following?.length ?? 0)}</strong>
          <span>{t('profile.following')}</span>
        </div>
        <div>
          <strong>{formatNumber(liveProfile.dailyStreams ?? 0)}</strong>
          <span>{t('profile.streamsToday')}</span>
        </div>
      </section>

      {isArtist ? (
        <>
          <section className="profile__card">
            <div className="profile__card-head">
              <h2>{t('profile.bio')}</h2>
              {isOwn && editing !== 'bio' ? (
                <button type="button" className="profile__link-btn" onClick={() => startEdit('bio')}>
                  {t('common.edit')}
                </button>
              ) : null}
            </div>
            {editing === 'bio' ? (
              <form className="profile__form" onSubmit={saveEdit}>
                <label className="profile__form-span">
                  {t('profile.bioLabel')}
                  <textarea
                    rows={4}
                    value={draft.bio}
                    onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                  />
                </label>
                <div className="profile__form-actions">
                  <button type="submit" className="profile__btn">
                    {t('common.save')}
                  </button>
                  <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <p className="profile__hint">{liveProfile.bio || t('profile.bioEmpty')}</p>
            )}
          </section>

          {viewerIsGold ? (
            <section className="profile__card profile__card--gold-stats">
              <div className="profile__card-head">
                <h2>{t('profile.goldStats')}</h2>
              </div>
              <div className="profile__stats profile__stats--nested">
                <div>
                  <strong>{formatNumber(totalListeners)}</strong>
                  <span>{t('profile.listeners')}</span>
                </div>
                <div>
                  <strong>{formatNumber(totalStreams)}</strong>
                  <span>{t('profile.totalStreams')}</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="profile__card">
            <div className="profile__card-head">
              <h2>{t('profile.albums')}</h2>
            </div>
            {artistAlbums.length === 0 ? (
              <p className="profile__hint">{t('profile.albumsEmpty')}</p>
            ) : (
              <div className="profile__releases">
                {artistAlbums.map((album) => (
                  <article key={album.id} className="profile__release">
                    <button
                      type="button"
                      className="profile__release-cover"
                      onClick={() => navigate(`/album/${album.id}`)}
                      aria-label={t('common.openAlbumAria', { title: album.title })}
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
                    {album.genre ? <p className="profile__release-genre">{album.genre}</p> : null}
                    <p>
                      {t('common.listenerCount', {
                        count: formatNumber(album.listeners || 0),
                      })}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="profile__card">
            <div className="profile__card-head">
              <h2>{t('profile.singles')}</h2>
            </div>
            {artistSingles.length === 0 ? (
              <p className="profile__hint">{t('profile.singlesEmpty')}</p>
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
                        aria-label={
                          isPlaying
                            ? t('common.pauseAria', { title: track.title })
                            : t('common.playAria', { title: track.title })
                        }
                      >
                        <img src={track.cover} alt="" />
                        {isPlaying ? (
                          <span className="profile__playing">
                            <PlayingBars />
                            <span>{t('common.nowPlaying')}</span>
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
                      {track.genre ? <p className="profile__release-genre">{track.genre}</p> : null}
                      {Array.isArray(track.collaborators) && track.collaborators.length > 0 ? (
                        <p className="profile__release-genre">
                          {t('common.featuring', {
                            names: track.collaborators.join(language === 'en' ? ', ' : '، '),
                          })}
                        </p>
                      ) : null}
                      <p>
                        {t('common.listenerCount', {
                          count: formatNumber(track.listeners || track.plays || 0),
                        })}
                      </p>
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
          <h2>{t('profile.personal')}</h2>
          {isOwn && editing !== 'personal' ? (
            <button type="button" className="profile__link-btn" onClick={() => startEdit('personal')}>
              {t('common.edit')}
            </button>
          ) : null}
        </div>
        {editing === 'personal' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              {t('auth.displayName')}
              <input
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
              />
            </label>
            <label>
              {t('auth.birthDate')}
              <input
                type="date"
                dir="ltr"
                value={draft.birthDate}
                onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
              />
            </label>
            <label>
              {t('auth.gender')}
              <select
                value={draft.gender}
                onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
              >
                <option value="">{t('common.genderPlaceholder')}</option>
                <option value="female">{genderLabel('female')}</option>
                <option value="male">{genderLabel('male')}</option>
                <option value="other">{genderLabel('other')}</option>
                <option value="unspecified">{genderLabel('unspecified')}</option>
              </select>
            </label>
            <div className="profile__form-actions">
              <button type="submit" className="profile__btn">
                {t('common.save')}
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <dl className="profile__dl">
            <div>
              <dt>{t('auth.displayName')}</dt>
              <dd>{liveProfile.displayName}</dd>
            </div>
            <div>
              <dt>{t('auth.birthDate')}</dt>
              <dd dir="ltr">{liveProfile.birthDate || '—'}</dd>
            </div>
            <div>
              <dt>{t('auth.gender')}</dt>
              <dd>{genderLabel(liveProfile.gender)}</dd>
            </div>
            <div>
              <dt>{t('auth.email')}</dt>
              <dd dir="ltr">{liveProfile.email}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>{t('profile.username')}</h2>
          {isOwn && editing !== 'username' ? (
            <button type="button" className="profile__link-btn" onClick={() => startEdit('username')}>
              {t('common.edit')}
            </button>
          ) : null}
        </div>
        {editing === 'username' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              {t('profile.usernameField')}
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
                {t('common.save')}
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                {t('common.cancel')}
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
          <h2>{t('profile.avatar')}</h2>
          {isOwn && editing !== 'avatar' ? (
            <button type="button" className="profile__link-btn" onClick={() => startEdit('avatar')}>
              {t('common.edit')}
            </button>
          ) : null}
        </div>
        {editing === 'avatar' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            {avatarEditable ? (
              <>
                <label>
                  {t('profile.uploadImage')}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAvatarFile(e.target.files?.[0])}
                  />
                </label>
                <label>
                  {t('profile.orImageUrl')}
                  <input
                    dir="ltr"
                    placeholder="https://..."
                    value={draft.avatar}
                    onChange={(e) => setDraft((d) => ({ ...d, avatar: e.target.value }))}
                  />
                </label>
                <div className="profile__form-actions">
                  <button type="submit" className="profile__btn">
                    {t('profile.saveUrl')}
                  </button>
                  <button
                    type="button"
                    className="profile__btn profile__btn--ghost"
                    onClick={async () => {
                      if (applyUpdate(await updateUser(liveProfile.id, { avatar: '' }))) {
                        setMessage(t('profile.saved'))
                        cancelEdit()
                      }
                    }}
                  >
                    {t('profile.removeAvatar')}
                  </button>
                  <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                    {t('common.cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="profile__hint">{t('profile.avatarBlocked')}</p>
                <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                  {t('common.close')}
                </button>
              </>
            )}
          </form>
        ) : (
          <p className="profile__hint">
            {liveProfile.avatar ? t('profile.avatarSet') : t('profile.avatarDefault')}
            {!canChangeAvatar(liveProfile.subscription) && isOwn
              ? t('profile.avatarBasicBlocked')
              : ''}
          </p>
        )}
      </section>

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>{t('profile.subscription')}</h2>
          {isOwn && editing !== 'subscription' ? (
            <button
              type="button"
              className="profile__link-btn"
              onClick={() => startEdit('subscription')}
            >
              {t('common.edit')}
            </button>
          ) : null}
        </div>
        {editing === 'subscription' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              {t('profile.subscription')}
              <select
                value={draft.subscription}
                onChange={(e) => setDraft((d) => ({ ...d, subscription: e.target.value }))}
              >
                <option value="basic">{subscriptionLabel('basic')}</option>
                <option value="silver">{subscriptionLabel('silver')}</option>
                <option value="gold">{subscriptionLabel('gold')}</option>
              </select>
            </label>
            <div className="profile__form-actions">
              <button type="submit" className="profile__btn">
                {t('common.save')}
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <p className="profile__value">{subscriptionLabel(liveProfile.subscription)}</p>
        )}
      </section>

      <section className="profile__card">
        <div className="profile__card-head">
          <h2>{t('profile.dailyStreams')}</h2>
          {isOwn && editing !== 'dailyStreams' ? (
            <button
              type="button"
              className="profile__link-btn"
              onClick={() => startEdit('dailyStreams')}
            >
              {t('common.edit')}
            </button>
          ) : null}
        </div>
        {editing === 'dailyStreams' ? (
          <form className="profile__form" onSubmit={saveEdit}>
            <label>
              {t('profile.dailyStreamsField')}
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
                {t('common.save')}
              </button>
              <button type="button" className="profile__btn profile__btn--ghost" onClick={cancelEdit}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <p className="profile__value">{formatNumber(liveProfile.dailyStreams ?? 0)}</p>
        )}
      </section>

      {isOwn ? (
        <section className="profile__card">
          <div className="profile__card-head">
            <h2>{t('profile.otherProfiles')}</h2>
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
          <Link to="/profile">{t('profile.backToMine')}</Link>
        </p>
      )}
    </div>
  )
}
