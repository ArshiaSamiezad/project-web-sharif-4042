import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './PlaylistsPage.css'

export default function PlaylistsPage() {
  const {
    getOwnedPlaylists,
    getPlaylistLimit,
    createPlaylist,
  } = useAuth()
  const navigate = useNavigate()

  const playlists = getOwnedPlaylists()
  const limit = getPlaylistLimit()
  const atLimit = Number.isFinite(limit) && playlists.length >= limit

  const [creating, setCreating] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createError, setCreateError] = useState('')

  const limitLabel = Number.isFinite(limit)
    ? `${playlists.length.toLocaleString('fa-IR')} از ${limit.toLocaleString('fa-IR')}`
    : `${playlists.length.toLocaleString('fa-IR')} • نامحدود`

  function openCreate() {
    setCreateError('')
    setCreateTitle('')
    setCreating(true)
  }

  function handleCreate(event) {
    event.preventDefault()
    const result = createPlaylist(createTitle)
    if (!result.ok) {
      setCreateError(result.error)
      return
    }
    setCreating(false)
    setCreateTitle('')
    setCreateError('')
    navigate(`/playlist/${result.playlist.id}`)
  }

  return (
    <div className="playlists">
      <header className="playlists__header">
        <div>
          <h1>پلی‌لیست‌ها</h1>
          <p>لیست‌های پخش شما</p>
        </div>
        <div className="playlists__header-actions">
          <span className="playlists__quota">{limitLabel}</span>
          {playlists.length > 0 ? (
            <button
              type="button"
              className="playlists__btn playlists__btn--primary"
              onClick={openCreate}
              disabled={atLimit}
              title={atLimit ? 'به سقف اشتراک رسیده‌اید' : undefined}
            >
              پلی‌لیست جدید
            </button>
          ) : null}
        </div>
      </header>

      {creating ? (
        <form className="playlists__create" onSubmit={handleCreate} noValidate>
          <label>
            <span>نام پلی‌لیست</span>
            <input
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder="مثلاً شب‌های بارانی"
              autoFocus
            />
          </label>
          {createError ? <p className="playlists__error">{createError}</p> : null}
          <div className="playlists__create-actions">
            <button type="submit" className="playlists__btn playlists__btn--primary">
              ایجاد
            </button>
            <button
              type="button"
              className="playlists__btn"
              onClick={() => {
                setCreating(false)
                setCreateError('')
              }}
            >
              انصراف
            </button>
          </div>
        </form>
      ) : null}

      {playlists.length === 0 && !creating ? (
        <div className="playlists__empty">
          <div className="playlists__empty-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>هنوز پلی‌لیستی ندارید</h2>
          <p>اولین لیست پخش خود را بسازید و آهنگ‌های محبوب‌تان را به آن اضافه کنید.</p>
          <button
            type="button"
            className="playlists__btn playlists__btn--primary"
            onClick={openCreate}
            disabled={atLimit}
          >
            ایجاد اولین پلی‌لیست
          </button>
        </div>
      ) : null}

      {playlists.length > 0 ? (
        <div className="playlists__grid">
          {playlists.map((playlist) => {
            const trackCount = (playlist.trackIds || []).length
            return (
              <article key={playlist.id} className="playlists__tile">
                <button
                  type="button"
                  className="playlists__tile-cover"
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                  aria-label={`باز کردن پلی‌لیست ${playlist.title}`}
                >
                  <img src={playlist.cover} alt="" />
                </button>
                <button
                  type="button"
                  className="playlists__tile-title"
                  onClick={() => navigate(`/playlist/${playlist.id}`)}
                >
                  {playlist.title}
                </button>
                <p className="playlists__tile-meta">
                  {trackCount.toLocaleString('fa-IR')} آهنگ
                </p>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
