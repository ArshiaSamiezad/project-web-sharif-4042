import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { idEq } from '../lib/ids'
import './PlaylistMenu.css'

export default function PlaylistMenu({ mode, trackId, albumId }) {
  const { getOwnedPlaylists, getPlaylistLimit, toggleTrackInPlaylist, toggleAlbumInPlaylist, getCatalog } =
    useAuth()
  const { t, formatNumber } = useI18n()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [tick, setTick] = useState(0)
  const rootRef = useRef(null)
  const menuId = useId()

  const playlists = getOwnedPlaylists()
  const limit = getPlaylistLimit()
  const catalog = getCatalog()

  useEffect(() => {
    if (!open) return undefined

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setMessage('')
      }
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        setMessage('')
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function albumTrackIds() {
    return catalog.tracks.filter((track) => idEq(track.albumId, albumId)).map((track) => track.id)
  }

  function isChecked(playlist) {
    const ids = playlist.trackIds || []
    if (mode === 'track') return ids.some((id) => idEq(id, trackId))
    const albumIds = albumTrackIds()
    return albumIds.length > 0 && albumIds.every((id) => ids.some((tid) => idEq(tid, id)))
  }

  function handleToggle(playlistId) {
    const action =
      mode === 'track'
        ? toggleTrackInPlaylist(playlistId, trackId)
        : toggleAlbumInPlaylist(playlistId, albumId)

    Promise.resolve(action).then((result) => {
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      setMessage(result.added ? t('playlists.addedFlash') : t('playlists.removedFlash'))
      setTick((n) => n + 1)
    })
  }

  return (
    <div className="pl-menu" ref={rootRef}>
      <button
        type="button"
        className="pl-menu__trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('playlists.menuAria')}
        title={t('playlists.menuAria')}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((v) => !v)
          setMessage('')
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open ? (
        <div
          className="pl-menu__panel"
          id={menuId}
          role="menu"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <p className="pl-menu__title">{t('playlists.myPlaylists')}</p>
          {playlists.length === 0 ? (
            <p className="pl-menu__empty">
              {t('playlists.emptyMenu')}
              {Number.isFinite(limit)
                ? ` ${t('playlists.limitHint', { limit: formatNumber(limit) })}`
                : null}
            </p>
          ) : (
            <ul className="pl-menu__list" key={tick}>
              {playlists.map((playlist) => {
                const checked = isChecked(playlist)
                return (
                  <li key={playlist.id}>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={checked}
                      className={`pl-menu__item${checked ? ' is-checked' : ''}`}
                      onClick={() => handleToggle(playlist.id)}
                    >
                      <span className="pl-menu__check" aria-hidden="true">
                        {checked ? '✓' : ''}
                      </span>
                      <span className="pl-menu__name">{playlist.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {Number.isFinite(limit) ? (
            <p className="pl-menu__limit">
              {t('playlists.menuQuotaFinite', {
                count: formatNumber(playlists.length),
                limit: formatNumber(limit),
              })}
            </p>
          ) : (
            <p className="pl-menu__limit">{t('playlists.menuQuotaInfinite')}</p>
          )}
          {message ? <p className="pl-menu__msg">{message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
