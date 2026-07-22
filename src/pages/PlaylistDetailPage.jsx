import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import { useI18n } from '../i18n/I18nProvider'
import PlayingBars from '../components/PlayingBars'
import AddTracksModal from '../components/AddTracksModal'
import './PlaylistsPage.css'
import './CatalogPages.css'

export default function PlaylistDetailPage() {
  const { playlistId } = useParams()
  const {
    currentUser,
    getCatalog,
    getUserById,
    renamePlaylist,
    deletePlaylist,
    toggleTrackInPlaylist,
  } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
  const { t, formatNumber } = useI18n()
  const navigate = useNavigate()

  const [renaming, setRenaming] = useState(false)
  const [renameTitle, setRenameTitle] = useState('')
  const [renameError, setRenameError] = useState('')
  const [actionError, setActionError] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const catalog = getCatalog()
  const playlist = catalog.playlists.find((item) => item.id === playlistId)
  if (!playlist || playlist.ownerId !== currentUser?.id) {
    return <Navigate to="/playlists" replace />
  }

  const tracks = (playlist.trackIds || [])
    .map((id) => catalog.tracks.find((track) => track.id === id))
    .filter(Boolean)

  function artistPath(artistId) {
    const user = getUserById(artistId)
    return user?.username ? `/profile/${user.username}` : '/profile'
  }

  function handleRename(event) {
    event.preventDefault()
    const result = renamePlaylist(playlist.id, renameTitle)
    if (!result.ok) {
      setRenameError(result.error)
      return
    }
    setRenaming(false)
    setRenameError('')
  }

  function handleDelete() {
    const confirmed = window.confirm(t('playlists.deleteConfirm', { title: playlist.title }))
    if (!confirmed) return
    const result = deletePlaylist(playlist.id)
    if (!result.ok) {
      setActionError(result.error)
      return
    }
    navigate('/playlists', { replace: true })
  }

  function handleRemoveTrack(trackId) {
    const result = toggleTrackInPlaylist(playlist.id, trackId)
    if (!result.ok) setActionError(result.error)
  }

  return (
    <div className="catalog album-page playlist-detail">
      <button type="button" className="album-page__back" onClick={() => navigate('/playlists')}>
        {t('playlists.backToPlaylists')}
      </button>

      <header className="album-page__hero">
        <img src={playlist.cover} alt="" className="album-page__cover" />
        <div className="album-page__info">
          <p className="album-page__eyebrow">{t('common.playlist')}</p>
          {renaming ? (
            <form className="playlists__rename" onSubmit={handleRename} noValidate>
              <input
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
                aria-label={t('playlists.renameAria')}
                autoFocus
              />
              {renameError ? <p className="playlists__error">{renameError}</p> : null}
              <div className="playlists__rename-actions">
                <button type="submit" className="playlists__btn playlists__btn--primary">
                  {t('common.save')}
                </button>
                <button
                  type="button"
                  className="playlists__btn"
                  onClick={() => {
                    setRenaming(false)
                    setRenameTitle(playlist.title)
                    setRenameError('')
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <h1>{playlist.title}</h1>
          )}
          <p className="album-page__meta">
            <span>{t('common.trackCount', { count: formatNumber(tracks.length) })}</span>
          </p>
          <div className="playlist-detail__actions">
            <button
              type="button"
              className="playlists__btn playlists__btn--accent"
              onClick={() => setAddOpen(true)}
            >
              {t('playlists.addTracks')}
            </button>
            {!renaming ? (
              <button
                type="button"
                className="playlists__btn"
                onClick={() => {
                  setRenameTitle(playlist.title)
                  setRenaming(true)
                  setRenameError('')
                }}
              >
                {t('playlists.rename')}
              </button>
            ) : null}
            <button
              type="button"
              className="playlists__btn playlists__btn--danger"
              onClick={handleDelete}
            >
              {t('common.delete')}
            </button>
          </div>
          {actionError ? <p className="playlists__error">{actionError}</p> : null}
        </div>
      </header>

      {tracks.length === 0 ? (
        <div className="playlist-detail__empty">
          <p>{t('playlists.emptyTracks')}</p>
          <button
            type="button"
            className="playlists__btn playlists__btn--primary"
            onClick={() => setAddOpen(true)}
          >
            {t('playlists.addTracks')}
          </button>
        </div>
      ) : (
        <ul className="album-page__tracks">
          {tracks.map((track, index) => {
            const isPlaying = playingTrackId === track.id
            const album = track.albumId
              ? catalog.albums.find((a) => a.id === track.albumId)
              : null

            return (
              <li
                key={track.id}
                className={`album-track${isPlaying ? ' is-playing' : ''}`}
              >
                <span className="album-track__index" aria-hidden="true">
                  {isPlaying ? <PlayingBars /> : formatNumber(index + 1)}
                </span>
                <button
                  type="button"
                  className="album-track__cover"
                  onClick={() => playTrack(track.id)}
                  aria-label={
                    isPlaying
                      ? t('common.pauseAria', { title: track.title })
                      : t('common.playAria', { title: track.title })
                  }
                >
                  <img src={track.cover} alt="" />
                </button>
                <div className="album-track__text">
                  <button
                    type="button"
                    className="album-track__title"
                    onClick={() => playTrack(track.id)}
                  >
                    {track.title}
                  </button>
                  <p className="playlist-detail__track-meta">
                    <Link to={artistPath(track.artistId)}>{track.artistName}</Link>
                    {album ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <Link to={`/album/${album.id}`}>{album.title}</Link>
                      </>
                    ) : null}
                  </p>
                </div>
                {isPlaying ? (
                  <span className="album-track__badge">{t('common.nowPlaying')}</span>
                ) : null}
                <button
                  type="button"
                  className="playlists__btn playlists__btn--ghost"
                  onClick={() => handleRemoveTrack(track.id)}
                  title={t('playlists.removeFromPlaylist')}
                >
                  {t('common.delete')}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <AddTracksModal
        open={addOpen}
        playlistId={playlist.id}
        onClose={() => setAddOpen(false)}
      />
    </div>
  )
}
