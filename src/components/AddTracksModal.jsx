import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { idEq } from '../lib/ids'
import './AddTracksModal.css'

function matchesQuery(text, query) {
  return String(text || '')
    .toLowerCase()
    .includes(query)
}

export default function AddTracksModal({ open, playlistId, onClose }) {
  const { currentUser, getCatalog, toggleTrackInPlaylist, toggleAlbumInPlaylist } = useAuth()
  const { t } = useI18n()
  const catalog = getCatalog()
  const titleId = useId()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())

  const playlist = catalog.playlists.find((p) => idEq(p.id, playlistId))
  const trackIds = playlist?.trackIds || []
  const isGold = currentUser?.subscription === 'gold'
  const normalizedQuery = query.trim().toLowerCase()

  const results = useMemo(() => {
    const visibleTracks = catalog.tracks.filter((track) => isGold || !track.earlyAccess)
    const visibleAlbums = catalog.albums.filter((album) => isGold || !album.earlyAccess)

    const singles = visibleTracks
      .filter((track) => !track.albumId)
      .filter((track) => {
        if (!normalizedQuery) return true
        return (
          matchesQuery(track.title, normalizedQuery) ||
          matchesQuery(track.artistName, normalizedQuery)
        )
      })
      .map((track) => ({ type: 'single', track }))
      .sort((a, b) => (b.track.plays || 0) - (a.track.plays || 0))

    const albums = visibleAlbums
      .map((album) => {
        const albumTracks = visibleTracks
          .filter((track) => idEq(track.albumId, album.id))
          .sort((a, b) => (b.plays || 0) - (a.plays || 0))

        if (!normalizedQuery) {
          return {
            type: 'album',
            album,
            tracks: albumTracks,
            allTracks: albumTracks,
            autoExpand: false,
            listeners: album.listeners || 0,
          }
        }

        const titleMatch = matchesQuery(album.title, normalizedQuery)
        const artistMatch =
          matchesQuery(album.artistName, normalizedQuery) ||
          albumTracks.some((track) => matchesQuery(track.artistName, normalizedQuery))
        const titleMatchedTracks = albumTracks.filter((track) =>
          matchesQuery(track.title, normalizedQuery),
        )

        if (!titleMatch && !artistMatch && titleMatchedTracks.length === 0) {
          return null
        }

        // Album name hit → all tracks. Track name hit → only matching tracks.
        const childTracks = titleMatch ? albumTracks : titleMatchedTracks.length > 0 ? titleMatchedTracks : albumTracks

        return {
          type: 'album',
          album,
          tracks: childTracks,
          allTracks: albumTracks,
          autoExpand: titleMatch || titleMatchedTracks.length > 0,
          listeners: album.listeners || 0,
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b.listeners || 0) - (a.listeners || 0))

    return [...albums, ...singles]
  }, [catalog.tracks, catalog.albums, isGold, normalizedQuery])

  useEffect(() => {
    if (!open) return undefined

    setQuery('')
    setMessage('')
    setExpandedIds(new Set())
    setCollapsedIds(new Set())
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

  useEffect(() => {
    setExpandedIds(new Set())
    setCollapsedIds(new Set())
  }, [normalizedQuery])

  if (!open || !playlist || !idEq(playlist.ownerId, currentUser?.id)) return null

  async function handleToggleTrack(trackId) {
    const result = await toggleTrackInPlaylist(playlistId, trackId)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage(result.added ? t('playlists.addedFlash') : t('playlists.removedFlash'))
  }

  async function handleToggleAlbum(albumId) {
    const result = await toggleAlbumInPlaylist(playlistId, albumId)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setMessage(result.added ? t('playlists.addedFlash') : t('playlists.removedFlash'))
  }

  function isAlbumExpanded(albumId, autoExpand) {
    if (collapsedIds.has(albumId)) return false
    if (autoExpand) return true
    return expandedIds.has(albumId)
  }

  function toggleExpanded(albumId, currentlyExpanded) {
    if (currentlyExpanded) {
      setCollapsedIds((prev) => new Set(prev).add(albumId))
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.delete(albumId)
        return next
      })
      return
    }

    setCollapsedIds((prev) => {
      const next = new Set(prev)
      next.delete(albumId)
      return next
    })
    setExpandedIds((prev) => new Set(prev).add(albumId))
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
            results.map((item) => {
              if (item.type === 'single') {
                const { track } = item
                const inPlaylist = trackIds.some((id) => idEq(id, track.id))

                return (
                  <article key={track.id} className="add-tracks-modal__row">
                    <img src={track.cover} alt="" />
                    <div className="add-tracks-modal__row-text">
                      <strong>{track.title}</strong>
                      <span>{track.artistName} • تک‌آهنگ</span>
                    </div>
                    <button
                      type="button"
                      className={`add-tracks-modal__action${inPlaylist ? ' is-added' : ''}`}
                      onClick={() => handleToggleTrack(track.id)}
                    >
                      {inPlaylist ? 'حذف' : 'افزودن'}
                    </button>
                  </article>
                )
              }

              const { album, tracks, allTracks, autoExpand } = item
              const isExpanded = isAlbumExpanded(album.id, autoExpand)
              const allIn =
                allTracks.length > 0 &&
                allTracks.every((track) => trackIds.some((id) => idEq(id, track.id)))
              const someIn = allTracks.some((track) =>
                trackIds.some((id) => idEq(id, track.id)),
              )

              return (
                <div key={album.id} className="add-tracks-modal__album-block">
                  <article className="add-tracks-modal__row add-tracks-modal__row--album">
                    <button
                      type="button"
                      className={`add-tracks-modal__expand${isExpanded ? ' is-open' : ''}`}
                      onClick={() => toggleExpanded(album.id, isExpanded)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? 'بستن آهنگ‌های آلبوم' : 'باز کردن آهنگ‌های آلبوم'}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <img src={album.cover} alt="" />
                    <div className="add-tracks-modal__row-text">
                      <strong>{album.title}</strong>
                      <span>
                        {album.artistName} • آلبوم • {allTracks.length} آهنگ
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`add-tracks-modal__action${allIn ? ' is-added' : ''}${someIn && !allIn ? ' is-partial' : ''}`}
                      onClick={() => handleToggleAlbum(album.id)}
                    >
                      {allIn ? 'حذف' : 'افزودن'}
                    </button>
                  </article>

                  {isExpanded ? (
                    <div className="add-tracks-modal__children">
                      {tracks.length === 0 ? (
                        <p className="add-tracks-modal__child-empty">آهنگی در این آلبوم نیست.</p>
                      ) : (
                        tracks.map((track) => {
                          const inPlaylist = trackIds.some((id) => idEq(id, track.id))
                          return (
                            <article
                              key={track.id}
                              className="add-tracks-modal__row add-tracks-modal__row--child"
                            >
                              <img src={track.cover} alt="" />
                              <div className="add-tracks-modal__row-text">
                                <strong>{track.title}</strong>
                                <span>{track.artistName}</span>
                              </div>
                              <button
                                type="button"
                                className={`add-tracks-modal__action${inPlaylist ? ' is-added' : ''}`}
                                onClick={() => handleToggleTrack(track.id)}
                              >
                                {inPlaylist ? 'حذف' : 'افزودن'}
                              </button>
                            </article>
                          )
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
