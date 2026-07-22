import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './PlaylistsPage.css'

export default function PlaylistsPage() {
  const {
    getOwnedPlaylists,
    getPlaylistLimit,
    createPlaylist,
  } = useAuth()
  const { t, formatNumber } = useI18n()
  const navigate = useNavigate()

  const playlists = getOwnedPlaylists()
  const limit = getPlaylistLimit()
  const atLimit = Number.isFinite(limit) && playlists.length >= limit

  const [creating, setCreating] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createError, setCreateError] = useState('')

  const limitLabel = Number.isFinite(limit)
    ? t('playlists.quotaFinite', {
        count: formatNumber(playlists.length),
        limit: formatNumber(limit),
      })
    : t('playlists.quotaInfinite', { count: formatNumber(playlists.length) })

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
          <h1>{t('playlists.title')}</h1>
          <p>{t('playlists.subtitle')}</p>
        </div>
        <div className="playlists__header-actions">
          <span className="playlists__quota">{limitLabel}</span>
          {playlists.length > 0 ? (
            <button
              type="button"
              className="playlists__btn playlists__btn--primary"
              onClick={openCreate}
              disabled={atLimit}
              title={atLimit ? t('playlists.atLimit') : undefined}
            >
              {t('playlists.new')}
            </button>
          ) : null}
        </div>
      </header>

      {creating ? (
        <form className="playlists__create" onSubmit={handleCreate} noValidate>
          <label>
            <span>{t('playlists.nameLabel')}</span>
            <input
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder={t('playlists.namePlaceholder')}
              autoFocus
            />
          </label>
          {createError ? <p className="playlists__error">{createError}</p> : null}
          <div className="playlists__create-actions">
            <button type="submit" className="playlists__btn playlists__btn--primary">
              {t('common.create')}
            </button>
            <button
              type="button"
              className="playlists__btn"
              onClick={() => {
                setCreating(false)
                setCreateError('')
              }}
            >
              {t('common.cancel')}
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
          <h2>{t('playlists.emptyTitle')}</h2>
          <p>{t('playlists.emptyBody')}</p>
          <button
            type="button"
            className="playlists__btn playlists__btn--primary"
            onClick={openCreate}
            disabled={atLimit}
          >
            {t('playlists.createFirst')}
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
                  aria-label={t('common.openPlaylistAria', { title: playlist.title })}
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
                  {t('common.trackCount', { count: formatNumber(trackCount) })}
                </p>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
