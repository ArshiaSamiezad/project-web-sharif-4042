import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './ArtistWorksPage.css'

const AUDIO_EXT = /\.(mp3|wav|flac)$/i
const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
])
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/jpg'])

function emptyTrackRow() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    title: '',
    lyrics: '',
    audio: null,
    collaborators: '',
  }
}

function isAudioFile(file) {
  if (!file) return false
  if (AUDIO_TYPES.has(file.type)) return true
  return AUDIO_EXT.test(file.name)
}

function isCoverFile(file) {
  if (!file) return false
  if (IMAGE_TYPES.has(file.type)) return true
  return /\.(jpe?g|png)$/i.test(file.name)
}

function fileMeta(file) {
  return { name: file.name, size: file.size, type: file.type }
}

export default function ArtistWorksPage() {
  const {
    currentUser,
    isVerifiedArtist,
    getOwnedWorks,
    getAlbumStats,
    getTrackStats,
    publishWork,
  } = useAuth()
  const { t, formatNumber } = useI18n()
  const navigate = useNavigate()
  const verified = isVerifiedArtist(currentUser)

  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({
    releaseType: 'single',
    title: '',
    genre: '',
    releaseYear: String(new Date().getFullYear()),
    collaborators: '',
    cover: '',
    coverName: '',
    earlyAccess: false,
    lyrics: '',
    audio: null,
    tracks: [emptyTrackRow()],
  })

  const owned = verified ? getOwnedWorks() : { albums: [], singles: [] }
  const albums = owned.albums
  const singles = owned.singles

  const items = useMemo(() => {
    const albumItems = albums.map((album) => ({
      kind: 'album',
      id: album.id,
      title: album.title,
      cover: album.cover,
      genre: album.genre,
      releasedAt: album.releasedAt,
      earlyAccess: album.earlyAccess,
      stats: getAlbumStats(album.id),
    }))
    const singleItems = singles.map((track) => ({
      kind: 'single',
      id: track.id,
      title: track.title,
      cover: track.cover,
      genre: track.genre,
      releasedAt: track.releasedAt,
      earlyAccess: track.earlyAccess,
      stats: getTrackStats(track.id),
    }))
    return [...albumItems, ...singleItems].sort((a, b) =>
      String(b.releasedAt).localeCompare(String(a.releasedAt)),
    )
  }, [albums, singles, getAlbumStats, getTrackStats])

  if (!verified) {
    return <Navigate to="/home" replace />
  }

  const visible = items.filter((item) => {
    if (filter === 'albums') return item.kind === 'album'
    if (filter === 'singles') return item.kind === 'single'
    return true
  })

  const totals = items.reduce(
    (acc, item) => ({
      listeners: acc.listeners + item.stats.listeners,
      streams: acc.streams + item.stats.streams,
      revenue: acc.revenue + item.stats.revenue,
    }),
    { listeners: 0, streams: 0, revenue: 0 },
  )

  function patchForm(patch) {
    setCreateError('')
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function openCreate() {
    setCreateError('')
    setForm({
      releaseType: 'single',
      title: '',
      genre: '',
      releaseYear: String(new Date().getFullYear()),
      collaborators: '',
      cover: '',
      coverName: '',
      earlyAccess: false,
      lyrics: '',
      audio: null,
      tracks: [emptyTrackRow()],
    })
    setCreating(true)
  }

  function handleCoverFile(file) {
    if (!file) return
    if (!isCoverFile(file)) {
      setCreateError(t('errors.worksCoverFormat'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      patchForm({ cover: String(reader.result), coverName: file.name })
    }
    reader.readAsDataURL(file)
  }

  function handleAudioFile(file) {
    if (!file) return
    if (!isAudioFile(file)) {
      setCreateError(t('errors.worksAudioFormat'))
      return
    }
    patchForm({ audio: fileMeta(file) })
  }

  function patchTrackRow(key, patch) {
    setCreateError('')
    setForm((prev) => ({
      ...prev,
      tracks: prev.tracks.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }))
  }

  function handleTrackAudio(key, file) {
    if (!file) return
    if (!isAudioFile(file)) {
      setCreateError(t('errors.worksAudioFormat'))
      return
    }
    patchTrackRow(key, { audio: fileMeta(file) })
  }

  async function handlePublish(event) {
    event.preventDefault()
    const isAlbum = form.releaseType === 'album'
    const payload = {
      releaseType: form.releaseType,
      title: form.title,
      genre: form.genre,
      releaseYear: form.releaseYear,
      collaborators: isAlbum ? '' : form.collaborators,
      cover: form.cover,
      earlyAccess: form.earlyAccess,
      lyrics: form.lyrics,
      audio: form.audio,
      tracks: form.tracks.map((row) => ({
        title: row.title,
        lyrics: row.lyrics,
        audio: row.audio,
        collaborators: row.collaborators,
      })),
    }

    const result = await publishWork(payload)
    if (!result.ok) {
      setCreateError(result.error)
      return
    }

    setCreating(false)
    if (result.kind === 'album') {
      navigate(`/artist/works/album/${result.album.id}`, {
        state: { notice: t('works.publishedOk') },
      })
      return
    }
    navigate(`/artist/works/single/${result.track.id}`, {
      state: { notice: t('works.publishedOk') },
    })
  }

  const isAlbumForm = form.releaseType === 'album'

  return (
    <div className="works">
      <header className="works__header">
        <div>
          <h1>{t('works.title')}</h1>
          <p>{t('works.subtitle')}</p>
        </div>
        <div className="works__header-actions">
          <span className="works__quota">
            {t('works.worksCount', { count: formatNumber(items.length) })}
          </span>
          {items.length > 0 ? (
            <button
              type="button"
              className="works__btn works__btn--primary"
              onClick={openCreate}
            >
              {t('works.publish')}
            </button>
          ) : null}
        </div>
      </header>

      {items.length > 0 ? (
        <section className="works__stats" aria-label={t('works.statsTitle')}>
          <div>
            <strong>{formatNumber(totals.listeners)}</strong>
            <span>{t('works.listeners')}</span>
          </div>
          <div>
            <strong>{formatNumber(totals.streams)}</strong>
            <span>{t('works.streams')}</span>
          </div>
          <div>
            <strong>{formatNumber(totals.revenue)}</strong>
            <span>{t('works.revenue')}</span>
          </div>
        </section>
      ) : null}

      {items.length > 0 ? (
        <div className="works__filters" role="tablist" aria-label={t('works.filterAll')}>
          {[
            { id: 'all', label: t('works.filterAll') },
            { id: 'albums', label: t('works.filterAlbums') },
            { id: 'singles', label: t('works.filterSingles') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              className={`works__filter${filter === tab.id ? ' is-active' : ''}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {creating ? (
        <form className="works__create" onSubmit={handlePublish} noValidate>
          <div className="works__create-grid">
            <label>
              <span>{t('works.releaseType')}</span>
              <select
                value={form.releaseType}
                onChange={(e) => patchForm({ releaseType: e.target.value })}
              >
                <option value="single">{t('common.single')}</option>
                <option value="album">{t('common.album')}</option>
              </select>
            </label>

            <label>
              <span>
                {isAlbumForm ? t('works.albumTitleLabel') : t('works.singleTitleLabel')}
              </span>
              <input
                value={form.title}
                onChange={(e) => patchForm({ title: e.target.value })}
                placeholder={
                  isAlbumForm
                    ? t('works.albumTitlePlaceholder')
                    : t('works.singleTitlePlaceholder')
                }
                autoFocus
              />
            </label>

            <label>
              <span>
                {isAlbumForm ? t('works.albumGenreLabel') : t('works.singleGenreLabel')}
              </span>
              <input
                value={form.genre}
                onChange={(e) => patchForm({ genre: e.target.value })}
                placeholder={t('works.genrePlaceholder')}
              />
            </label>

            <label>
              <span>{t('works.yearLabel')}</span>
              <input
                type="number"
                min="1900"
                max="2100"
                value={form.releaseYear}
                onChange={(e) => patchForm({ releaseYear: e.target.value })}
                dir="ltr"
              />
            </label>

            {!isAlbumForm ? (
              <label className="works__span-2">
                <span>{t('works.collaboratorsLabel')}</span>
                <input
                  value={form.collaborators}
                  onChange={(e) => patchForm({ collaborators: e.target.value })}
                  placeholder={t('works.collaboratorsPlaceholder')}
                />
                <small>{t('works.collaboratorsHint')}</small>
              </label>
            ) : null}

            <label>
              <span>
                {isAlbumForm ? t('works.albumCoverLabel') : t('works.singleCoverLabel')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                onChange={(e) => handleCoverFile(e.target.files?.[0])}
              />
              <small>
                {form.coverName || t('works.coverHint')}
              </small>
            </label>

            <label className="works__check">
              <input
                type="checkbox"
                checked={form.earlyAccess}
                onChange={(e) => patchForm({ earlyAccess: e.target.checked })}
              />
              <span>{t('works.earlyAccess')}</span>
            </label>
          </div>

          {form.cover ? (
            <div className="works__cover-preview">
              <img src={form.cover} alt="" />
            </div>
          ) : null}

          {!isAlbumForm ? (
            <div className="works__create-grid">
              <label>
                <span>{t('works.audioLabel')}</span>
                <input
                  type="file"
                  accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
                  onChange={(e) => handleAudioFile(e.target.files?.[0])}
                />
                <small>
                  {form.audio
                    ? t('works.audioFile', { name: form.audio.name })
                    : t('works.audioHint')}
                </small>
              </label>
              <label className="works__span-2">
                <span>{t('works.lyricsLabel')}</span>
                <textarea
                  rows={4}
                  value={form.lyrics}
                  onChange={(e) => patchForm({ lyrics: e.target.value })}
                  placeholder={t('works.lyricsPlaceholder')}
                />
              </label>
            </div>
          ) : (
            <div className="works__track-list">
              <div className="works__track-list-head">
                <h2>{t('works.albumTracks')}</h2>
                <button
                  type="button"
                  className="works__btn"
                  onClick={() =>
                    patchForm({ tracks: [...form.tracks, emptyTrackRow()] })
                  }
                >
                  {t('works.addAlbumTrack')}
                </button>
              </div>
              {form.tracks.map((row, index) => (
                <div key={row.key} className="works__track-row">
                  <p className="works__track-index">{formatNumber(index + 1)}</p>
                  <label>
                    <span>{t('works.trackTitleLabel')}</span>
                    <input
                      value={row.title}
                      onChange={(e) => patchTrackRow(row.key, { title: e.target.value })}
                      placeholder={t('works.trackTitlePlaceholder')}
                    />
                  </label>
                  <label>
                    <span>{t('works.audioLabel')}</span>
                    <input
                      type="file"
                      accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
                      onChange={(e) => handleTrackAudio(row.key, e.target.files?.[0])}
                    />
                    <small>
                      {row.audio
                        ? t('works.audioFile', { name: row.audio.name })
                        : t('works.audioHint')}
                    </small>
                  </label>
                  <label className="works__span-2">
                    <span>{t('works.trackCollaboratorsLabel')}</span>
                    <input
                      value={row.collaborators}
                      onChange={(e) =>
                        patchTrackRow(row.key, { collaborators: e.target.value })
                      }
                      placeholder={t('works.collaboratorsPlaceholder')}
                    />
                    <small>{t('works.collaboratorsHint')}</small>
                  </label>
                  <label className="works__span-2">
                    <span>{t('works.lyricsLabel')}</span>
                    <textarea
                      rows={3}
                      value={row.lyrics}
                      onChange={(e) => patchTrackRow(row.key, { lyrics: e.target.value })}
                      placeholder={t('works.lyricsPlaceholder')}
                    />
                  </label>
                  {form.tracks.length > 1 ? (
                    <button
                      type="button"
                      className="works__btn works__btn--ghost"
                      onClick={() =>
                        patchForm({
                          tracks: form.tracks.filter((item) => item.key !== row.key),
                        })
                      }
                    >
                      {t('works.removeTrackRow')}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {createError ? <p className="works__error">{createError}</p> : null}

          <div className="works__create-actions">
            <button type="submit" className="works__btn works__btn--primary">
              {t('works.submitPublish')}
            </button>
            <button
              type="button"
              className="works__btn"
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

      {items.length === 0 && !creating ? (
        <div className="works__empty">
          <div className="works__empty-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>{t('works.emptyTitle')}</h2>
          <p>{t('works.emptyBody')}</p>
          <button
            type="button"
            className="works__btn works__btn--primary"
            onClick={openCreate}
          >
            {t('works.publishFirst')}
          </button>
        </div>
      ) : null}

      {visible.length > 0 ? (
        <div className="works__grid">
          {visible.map((item) => (
            <article key={`${item.kind}-${item.id}`} className="works__tile">
              <button
                type="button"
                className="works__tile-cover"
                onClick={() => navigate(`/artist/works/${item.kind}/${item.id}`)}
                aria-label={t('works.openWorkAria', { title: item.title })}
              >
                <img src={item.cover} alt="" />
              </button>
              <button
                type="button"
                className="works__tile-title"
                onClick={() => navigate(`/artist/works/${item.kind}/${item.id}`)}
              >
                {item.title}
              </button>
              <p className="works__tile-meta">
                {item.kind === 'album' ? t('common.album') : t('common.single')}
                {item.genre ? ` • ${item.genre}` : ''}
                {item.earlyAccess ? ` • ${t('home.earlyAccess')}` : ''}
              </p>
              <p className="works__tile-stats">
                {t('common.listenerCount', {
                  count: formatNumber(item.stats.listeners),
                })}
                {' · '}
                {formatNumber(item.stats.streams)} {t('works.streams')}
                {' · '}
                {formatNumber(item.stats.revenue)} {t('works.revenue')}
              </p>
              {item.kind === 'album' ? (
                <p className="works__tile-meta">
                  {t('common.trackCount', {
                    count: formatNumber(item.stats.trackCount),
                  })}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
