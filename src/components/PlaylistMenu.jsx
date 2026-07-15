import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './PlaylistMenu.css'

export default function PlaylistMenu({ mode, trackId, albumId }) {
  const { getOwnedPlaylists, getPlaylistLimit, toggleTrackInPlaylist, toggleAlbumInPlaylist, getCatalog } =
    useAuth()
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
    return catalog.tracks.filter((t) => t.albumId === albumId).map((t) => t.id)
  }

  function isChecked(playlist) {
    const ids = playlist.trackIds || []
    if (mode === 'track') return ids.includes(trackId)
    const albumIds = albumTrackIds()
    return albumIds.length > 0 && albumIds.every((id) => ids.includes(id))
  }

  function handleToggle(playlistId) {
    const result =
      mode === 'track'
        ? toggleTrackInPlaylist(playlistId, trackId)
        : toggleAlbumInPlaylist(playlistId, albumId)

    if (!result.ok) {
      setMessage(result.error)
      return
    }

    setMessage(result.added ? 'به پلی‌لیست افزوده شد.' : 'از پلی‌لیست حذف شد.')
    setTick((n) => n + 1)
  }

  return (
    <div className="pl-menu" ref={rootRef}>
      <button
        type="button"
        className="pl-menu__trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="مدیریت پلی‌لیست"
        title="مدیریت پلی‌لیست"
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
          <p className="pl-menu__title">پلی‌لیست‌های من</p>
          {playlists.length === 0 ? (
            <p className="pl-menu__empty">
              هنوز پلی‌لیستی ندارید.
              {Number.isFinite(limit)
                ? ` (سقف اشتراک شما: ${limit.toLocaleString('fa-IR')} پلی‌لیست)`
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
              {playlists.length.toLocaleString('fa-IR')} از {limit.toLocaleString('fa-IR')} پلی‌لیست
            </p>
          ) : (
            <p className="pl-menu__limit">پلی‌لیست نامحدود (طلایی)</p>
          )}
          {message ? <p className="pl-menu__msg">{message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
