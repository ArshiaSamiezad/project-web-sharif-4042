import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './AddTracksModal.css'

function matchesQuery(text, query) {
  return String(text || '')
    .toLowerCase()
    .includes(query)
}

export default function AddTracksModal({ open, playlistId, onClose }) {
  const { currentUser, getCatalog, toggleTrackInPlaylist } = useAuth()
  const { t } = useI18n()
  const catalog = getCatalog()
  const titleId = useId()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')

  const playlist = catalog.playlists.find((p) => p.id === playlistId)
  const trackIds = playlist?.trackIds || []
  const isGold = currentUser?.subscription === 'gold'
  const normalizedQuery = query.trim().toLowerCase()

  const results = useMemo(() => {
    return catalog.tracks
      .filter((track) => isGold || !track.earlyAccess)
      .filter((track) => {
        if (!normalizedQuery) return true
        const album = track.albumId
          ? catalog.albums.find((a) => a.id === track.albumId)
          : null
        return (
          matchesQuery(track.title, normalizedQuery) ||
          matchesQuery(track.artistName, normalizedQuery) ||
          matchesQuery(album?.title, normalizedQuery)
        )
      })
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
  }, [catalog.tracks, catalog.albums, isGold, normalizedQuery])

  useEffect(() => {
    if (!open) return undefined

    setQuery('')
    setMessage('')
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || !playlist || playlist.ownerId !== currentUser?.id) return null

  function handleToggle(trackId) {
    const result = toggleTrackInPlaylist(playlistId, trackId)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage(result.added ? t('playlists.addedFlash') : t('playlists.removedFlash'))
  }

  return createPortal(
    <div className="add-tracks-modal" role="presentation" onClick={onClose}>
      <div
        className="add-tracks-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="add-tracks-modal__head">
          <div>
            <h2 id={titleId}>{t('playlists.addTracksTitle')}</h2>
            <p>{t('playlists.addTracksTo', { title: playlist.title })}</p>
          </div>
          <button
            type="button"
            className="add-tracks-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </header>

        <label className="add-tracks-modal__search">
          <span className="visually-hidden">{t('common.search')}</span>
          <span className="add-tracks-modal__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16.2 16.2 20 20" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('playlists.addTracksSearch')}
            autoComplete="off"
          />
        </label>

        {message ? <p className="add-tracks-modal__msg">{message}</p> : null}

        <div className="add-tracks-modal__list">
          {results.length === 0 ? (
            <p className="add-tracks-modal__empty">{t('playlists.nothingFound')}</p>
          ) : (
            results.map((track) => {
              const inPlaylist = trackIds.includes(track.id)
              const album = track.albumId
                ? catalog.albums.find((a) => a.id === track.albumId)
                : null

              return (
                <article key={track.id} className="add-tracks-modal__row">
                  <img src={track.cover} alt="" />
                  <div className="add-tracks-modal__row-text">
                    <strong>{track.title}</strong>
                    <span>
                      {track.artistName}
                      {album ? ` • ${album.title}` : t('playlists.singleSuffix')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`add-tracks-modal__action${inPlaylist ? ' is-added' : ''}`}
                    onClick={() => handleToggle(track.id)}
                  >
                    {inPlaylist ? t('common.delete') : t('playlists.add')}
                  </button>
                </article>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
