import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { idEq } from '../lib/ids'
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

function yearFromDate(value) {
  const y = Number(String(value || '').slice(0, 4))
  return Number.isFinite(y) && y > 0 ? String(y) : String(new Date().getFullYear())
}

function collaboratorsToText(list, language = 'fa') {
  if (!Array.isArray(list) || list.length === 0) return ''
  return list.join(language === 'en' ? ', ' : '، ')
}

export default function ArtistWorkDetailPage() {
  const { kind, workId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    currentUser,
    isVerifiedArtist,
    getCatalog,
    getAlbumStats,
    getTrackStats,
    updateAlbum,
    deleteAlbum,
    updateTrack,
    deleteTrack,
    addTrackToAlbum,
  } = useAuth()
  const { t, formatNumber, language } = useI18n()

  const verified = isVerifiedArtist(currentUser)
  const catalog = getCatalog()
  const isAlbum = kind === 'album'
  const isSingle = kind === 'single'

  const album = isAlbum ? catalog.albums.find((a) => idEq(a.id, workId)) : null
  const single = isSingle ? catalog.tracks.find((tr) => idEq(tr.id, workId)) : null
  const ownedAlbum = album && idEq(album.artistId, currentUser?.id)
  const ownedSingle = single && idEq(single.artistId, currentUser?.id) && !single.albumId

  const [notice, setNotice] = useState(location.state?.notice || '')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({})
  const [addingTrack, setAddingTrack] = useState(false)
  const [trackDraft, setTrackDraft] = useState({
    title: '',
    lyrics: '',
    audio: null,
    collaborators: '',
  })
  const [editingTrackId, setEditingTrackId] = useState(null)
  const [trackEdit, setTrackEdit] = useState({
    title: '',
    lyrics: '',
    audio: null,
    collaborators: '',
  })

  if (!verified || (!isAlbum && !isSingle)) {
    return <Navigate to="/home" replace />
  }
  if (isAlbum && !ownedAlbum) {
    return <Navigate to="/artist/works" replace />
  }
  if (isSingle && !ownedSingle) {
    return <Navigate to="/artist/works" replace />
  }

  const work = isAlbum ? album : single
  const stats = isAlbum ? getAlbumStats(work.id) : getTrackStats(work.id)
  const albumTracks = isAlbum
    ? catalog.tracks.filter((tr) => idEq(tr.albumId, work.id))
    : []

  function startEdit() {
    setError('')
    setNotice('')
    setEditing(true)
    setDraft({
      title: work.title || '',
      genre: work.genre || '',
      releaseYear: yearFromDate(work.releasedAt),
      collaborators: isSingle ? collaboratorsToText(work.collaborators, language) : '',
      cover: work.cover || '',
      earlyAccess: Boolean(work.earlyAccess),
      lyrics: work.lyrics || '',
      audio: work.audio || null,
    })
  }

  function handleCoverFile(file) {
    if (!file) return
    if (!isCoverFile(file)) {
      setError(t('errors.worksCoverFormat'))
      return
    }
    setDraft((prev) => ({
      ...prev,
      cover: URL.createObjectURL(file),
      coverFile: file,
    }))
    setError('')
  }

  function handleAudioFile(file, setter) {
    if (!file) return
    if (!isAudioFile(file)) {
      setError(t('errors.worksAudioFormat'))
      return
    }
    setter((prev) => ({ ...prev, audio: file }))
    setError('')
  }

  async function handleSave(event) {
    event.preventDefault()
    const patch = {
      title: draft.title,
      genre: draft.genre,
      releaseYear: draft.releaseYear,
      earlyAccess: draft.earlyAccess,
    }
    if (draft.coverFile) {
      patch.cover = draft.coverFile
      patch.coverFile = draft.coverFile
    }
    if (isSingle) {
      patch.collaborators = draft.collaborators
      patch.lyrics = draft.lyrics
      if (draft.audio instanceof File) patch.audio = draft.audio
    }

    const result = isAlbum
      ? await updateAlbum(work.id, patch)
      : await updateTrack(work.id, patch)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditing(false)
    setNotice(t('works.savedOk'))
  }

  async function handleDeleteWork() {
    const confirmed = window.confirm(t('works.deleteConfirm', { title: work.title }))
    if (!confirmed) return
    const result = isAlbum ? await deleteAlbum(work.id) : await deleteTrack(work.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/artist/works', { replace: true })
  }

  async function handleAddTrack(event) {
    event.preventDefault()
    const result = await addTrackToAlbum(work.id, trackDraft)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setAddingTrack(false)
    setTrackDraft({ title: '', lyrics: '', audio: null, collaborators: '' })
    setNotice(t('works.trackAddedOk'))
  }

  function startTrackEdit(track) {
    setEditingTrackId(track.id)
    setTrackEdit({
      title: track.title || '',
      lyrics: track.lyrics || '',
      audio: track.audio || null,
      collaborators: collaboratorsToText(track.collaborators, language),
    })
    setError('')
  }

  async function handleSaveTrack(event) {
    event.preventDefault()
    const patch = {
      title: trackEdit.title,
      lyrics: trackEdit.lyrics,
      collaborators: trackEdit.collaborators,
    }
    if (trackEdit.audio instanceof File) {
      patch.audio = trackEdit.audio
    }
    const result = await updateTrack(editingTrackId, patch)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditingTrackId(null)
    setNotice(t('works.savedOk'))
  }

  async function handleDeleteTrack(track) {
    const confirmed = window.confirm(t('works.deleteTrackConfirm', { title: track.title }))
    if (!confirmed) return
    const result = await deleteTrack(track.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNotice(t('works.savedOk'))
  }

  return (
    <div className="works works--detail">
      <button type="button" className="works__back" onClick={() => navigate('/artist/works')}>
        {t('works.backToWorks')}
      </button>

      <header className="works__detail-hero">
        <img src={work.cover} alt="" className="works__detail-cover" />
        <div className="works__detail-info">
          <p className="works__eyebrow">
            {isAlbum ? t('common.album') : t('common.single')}
            {work.earlyAccess ? ` · ${t('home.earlyAccess')}` : ''}
          </p>
          <h1>{work.title}</h1>
          <p className="works__detail-meta">
            {work.genre
              ? `${t('common.genreLabel')}: ${work.genre}`
              : t('works.noGenre')}
            {' · '}
            {yearFromDate(work.releasedAt)}
          </p>
          {isSingle ? (
            <p className="works__detail-meta">
              {collaboratorsToText(work.collaborators, language)
                ? t('common.featuring', {
                    names: collaboratorsToText(work.collaborators, language),
                  })
                : t('works.noCollaborators')}
            </p>
          ) : null}
          <div className="works__detail-actions">
            {!editing ? (
              <button type="button" className="works__btn works__btn--accent" onClick={startEdit}>
                {t('common.edit')}
              </button>
            ) : null}
            {isAlbum ? (
              <Link className="works__btn" to={`/album/${work.id}`}>
                {t('works.publicView')}
              </Link>
            ) : null}
            <button
              type="button"
              className="works__btn works__btn--danger"
              onClick={handleDeleteWork}
            >
              {t('works.deleteWork')}
            </button>
          </div>
          {notice ? <p className="works__ok">{notice}</p> : null}
          {error ? <p className="works__error">{error}</p> : null}
        </div>
      </header>

      <section className="works__stats" aria-label={t('works.statsTitle')}>
        <div>
          <strong>{formatNumber(stats.listeners)}</strong>
          <span>{t('works.listeners')}</span>
        </div>
        <div>
          <strong>{formatNumber(stats.streams)}</strong>
          <span>{t('works.streams')}</span>
        </div>
        <div>
          <strong>{formatNumber(stats.revenue)}</strong>
          <span>{t('works.revenue')}</span>
        </div>
        {isAlbum ? (
          <div>
            <strong>{formatNumber(stats.trackCount)}</strong>
            <span>{t('works.trackCount')}</span>
          </div>
        ) : null}
      </section>

      {editing ? (
        <form className="works__create" onSubmit={handleSave} noValidate>
          <h2>{isAlbum ? t('works.editAlbumTitle') : t('works.editSingleTitle')}</h2>
          <div className="works__create-grid">
            <label>
              <span>
                {isAlbum ? t('works.albumTitleLabel') : t('works.singleTitleLabel')}
              </span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label>
              <span>
                {isAlbum ? t('works.albumGenreLabel') : t('works.singleGenreLabel')}
              </span>
              <input
                value={draft.genre}
                onChange={(e) => setDraft((prev) => ({ ...prev, genre: e.target.value }))}
              />
            </label>
            <label>
              <span>{t('works.yearLabel')}</span>
              <input
                type="number"
                min="1900"
                max="2100"
                value={draft.releaseYear}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, releaseYear: e.target.value }))
                }
                dir="ltr"
              />
            </label>
            {isSingle ? (
              <label className="works__span-2">
                <span>{t('works.collaboratorsLabel')}</span>
                <input
                  value={draft.collaborators}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, collaborators: e.target.value }))
                  }
                  placeholder={t('works.collaboratorsPlaceholder')}
                />
              </label>
            ) : null}
            <label>
              <span>
                {isAlbum ? t('works.albumCoverLabel') : t('works.singleCoverLabel')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                onChange={(e) => handleCoverFile(e.target.files?.[0])}
              />
              <small>{t('works.coverChange')}</small>
            </label>
            <label className="works__check">
              <input
                type="checkbox"
                checked={draft.earlyAccess}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, earlyAccess: e.target.checked }))
                }
              />
              <span>{t('works.earlyAccess')}</span>
            </label>
            {isSingle ? (
              <>
                <label>
                  <span>{t('works.audioLabel')}</span>
                  <input
                    type="file"
                    accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
                    onChange={(e) => handleAudioFile(e.target.files?.[0], setDraft)}
                  />
                  <small>
                    {draft.audio
                      ? t('works.audioFile', { name: draft.audio.name })
                      : t('works.audioHint')}
                  </small>
                </label>
                <label className="works__span-2">
                  <span>{t('works.lyricsLabel')}</span>
                  <textarea
                    rows={5}
                    value={draft.lyrics}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, lyrics: e.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}
          </div>
          <div className="works__create-actions">
            <button type="submit" className="works__btn works__btn--primary">
              {t('works.saveChanges')}
            </button>
            <button
              type="button"
              className="works__btn"
              onClick={() => {
                setEditing(false)
                setError('')
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {isSingle && !editing ? (
        <section className="works__panel">
          <h2>{t('works.lyricsLabel')}</h2>
          <pre className="works__lyrics">
            {work.lyrics?.trim() ? work.lyrics : t('works.noLyrics')}
          </pre>
          <p className="works__detail-meta">
            {work.audio
              ? t('works.audioFile', { name: work.audio.name })
              : t('works.noAudio')}
          </p>
        </section>
      ) : null}

      {isAlbum ? (
        <section className="works__panel">
          <div className="works__track-list-head">
            <h2>{t('works.albumTracksHeading')}</h2>
            <button
              type="button"
              className="works__btn works__btn--accent"
              onClick={() => {
                setAddingTrack(true)
                setError('')
                setNotice('')
              }}
            >
              {t('works.addTrack')}
            </button>
          </div>

          {addingTrack ? (
            <form className="works__create works__create--nested" onSubmit={handleAddTrack} noValidate>
              <label>
                <span>{t('works.trackTitleLabel')}</span>
                <input
                  value={trackDraft.title}
                  onChange={(e) =>
                    setTrackDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  autoFocus
                />
              </label>
              <label>
                <span>{t('works.audioLabel')}</span>
                <input
                  type="file"
                  accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
                  onChange={(e) => handleAudioFile(e.target.files?.[0], setTrackDraft)}
                />
                <small>
                  {trackDraft.audio
                    ? t('works.audioFile', { name: trackDraft.audio.name })
                    : t('works.audioHint')}
                </small>
              </label>
              <label>
                <span>{t('works.trackCollaboratorsLabel')}</span>
                <input
                  value={trackDraft.collaborators}
                  onChange={(e) =>
                    setTrackDraft((prev) => ({ ...prev, collaborators: e.target.value }))
                  }
                  placeholder={t('works.collaboratorsPlaceholder')}
                />
                <small>{t('works.collaboratorsHint')}</small>
              </label>
              <label>
                <span>{t('works.lyricsLabel')}</span>
                <textarea
                  rows={3}
                  value={trackDraft.lyrics}
                  onChange={(e) =>
                    setTrackDraft((prev) => ({ ...prev, lyrics: e.target.value }))
                  }
                />
              </label>
              <div className="works__create-actions">
                <button type="submit" className="works__btn works__btn--primary">
                  {t('works.addTrack')}
                </button>
                <button
                  type="button"
                  className="works__btn"
                  onClick={() => setAddingTrack(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : null}

          {albumTracks.length === 0 ? (
            <p className="works__detail-meta">{t('works.noTracks')}</p>
          ) : (
            <ul className="works__managed-tracks">
              {albumTracks.map((track) => {
                const trackStats = getTrackStats(track.id)
                const isEditing = editingTrackId === track.id
                return (
                  <li key={track.id} className="works__managed-track">
                    {isEditing ? (
                      <form onSubmit={handleSaveTrack} className="works__track-edit" noValidate>
                        <input
                          value={trackEdit.title}
                          onChange={(e) =>
                            setTrackEdit((prev) => ({ ...prev, title: e.target.value }))
                          }
                          aria-label={t('works.trackTitleLabel')}
                        />
                        <label>
                          <span>{t('works.trackCollaboratorsLabel')}</span>
                          <input
                            value={trackEdit.collaborators}
                            onChange={(e) =>
                              setTrackEdit((prev) => ({
                                ...prev,
                                collaborators: e.target.value,
                              }))
                            }
                            placeholder={t('works.collaboratorsPlaceholder')}
                          />
                        </label>
                        <textarea
                          rows={3}
                          value={trackEdit.lyrics}
                          onChange={(e) =>
                            setTrackEdit((prev) => ({ ...prev, lyrics: e.target.value }))
                          }
                          aria-label={t('works.lyricsLabel')}
                        />
                        <label>
                          <span>{t('works.audioLabel')}</span>
                          <input
                            type="file"
                            accept=".mp3,.wav,.flac,audio/mpeg,audio/wav,audio/flac"
                            onChange={(e) =>
                              handleAudioFile(e.target.files?.[0], setTrackEdit)
                            }
                          />
                          <small>
                            {trackEdit.audio
                              ? t('works.audioFile', { name: trackEdit.audio.name })
                              : t('works.audioHint')}
                          </small>
                        </label>
                        <div className="works__create-actions">
                          <button type="submit" className="works__btn works__btn--primary">
                            {t('common.save')}
                          </button>
                          <button
                            type="button"
                            className="works__btn"
                            onClick={() => setEditingTrackId(null)}
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="works__managed-track-main">
                          <strong>{track.title}</strong>
                          <p>
                            {formatNumber(trackStats.streams)} {t('works.streams')}
                            {' · '}
                            {formatNumber(trackStats.listeners)} {t('works.listeners')}
                            {' · '}
                            {formatNumber(trackStats.revenue)} {t('works.revenue')}
                          </p>
                          <p className="works__detail-meta">
                            {collaboratorsToText(track.collaborators, language)
                              ? t('common.featuring', {
                                  names: collaboratorsToText(track.collaborators, language),
                                })
                              : t('works.noCollaborators')}
                          </p>
                          <p className="works__detail-meta">
                            {track.audio
                              ? t('works.audioFile', { name: track.audio.name })
                              : t('works.noAudio')}
                          </p>
                          <pre className="works__lyrics works__lyrics--compact">
                            {track.lyrics?.trim() ? track.lyrics : t('works.noLyrics')}
                          </pre>
                        </div>
                        <div className="works__managed-track-actions">
                          <button
                            type="button"
                            className="works__btn"
                            onClick={() => startTrackEdit(track)}
                          >
                            {t('works.editTrack')}
                          </button>
                          <button
                            type="button"
                            className="works__btn works__btn--ghost"
                            onClick={() => handleDeleteTrack(track)}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
