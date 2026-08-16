import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import { useI18n } from '../i18n/I18nProvider'
import { catalogApi } from '../lib/api'
import { mapTrackFromApi } from '../lib/catalogMap'
import { idEq } from '../lib/ids'
import PlayingBars from './PlayingBars'
import './SuggestTracksPanel.css'

const VISIBLE = 5
const SUCCESS_MS = 900
const ERROR_MS = 1400

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function SuggestTracksPanel({ playlistId }) {
  const { currentUser, getCatalog, getUserById, getUserMaps, toggleTrackInPlaylist } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
  const { t } = useI18n()
  const catalog = getCatalog()

  const [{ visible, reserve }, setBundle] = useState({ visible: [], reserve: [] })
  const [toast, setToast] = useState(null)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [fetched, setFetched] = useState(false)

  const playlist = catalog.playlists.find((item) => idEq(item.id, playlistId))
  const busy = toast === 'loading'

  useEffect(() => {
    setBundle({ visible: [], reserve: [] })
    setError('')
    setFlash('')
    setFetched(false)
    setToast(null)
  }, [playlistId])

  if (!playlist || !idEq(playlist.ownerId, currentUser?.id)) return null

  function artistPath(artistId) {
    const user = getUserById(artistId)
    return user?.username ? `/profile/${user.username}` : '/profile'
  }

  function resolveTracks(apiTracks) {
    const maps = getUserMaps()
    return (apiTracks || []).map((item) => {
      const mapped = mapTrackFromApi(item, maps)
      const local = catalog.tracks.find((track) => idEq(track.id, mapped.id))
      return local || mapped
    })
  }

  async function fetchSuggestions() {
    if (busy) return
    setToast('loading')
    setError('')
    setFlash('')
    try {
      const data = await catalogApi.recommendPlaylistTracks(playlistId)
      const tracks = resolveTracks(data.tracks)
      setBundle({
        visible: tracks.slice(0, VISIBLE),
        reserve: tracks.slice(VISIBLE),
      })
      setFetched(true)
      if (!tracks.length) {
        setError(t('playlists.suggestEmpty'))
        setToast('error')
        await wait(ERROR_MS)
        setToast(null)
        return
      }
      setToast('success')
      await wait(SUCCESS_MS)
      setToast(null)
    } catch (err) {
      setError(t('playlists.suggestError'))
      setFetched(true)
      setToast('error')
      await wait(ERROR_MS)
      setToast(null)
    }
  }

  function handleAdd(trackId) {
    toggleTrackInPlaylist(playlistId, trackId).then((result) => {
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (!result.added) {
        setFlash(t('playlists.removedFlash'))
        return
      }

      setFlash(t('playlists.addedFlash'))
      setError('')
      setBundle(({ visible: prevVisible, reserve: prevReserve }) => {
        const filtered = prevVisible.filter((track) => !idEq(track.id, trackId))
        if (!prevReserve.length) {
          return { visible: filtered, reserve: prevReserve }
        }
        const [take, ...rest] = prevReserve
        return { visible: [...filtered, take], reserve: rest }
      })
    })
  }

  const toastNode =
    toast && typeof document !== 'undefined'
      ? createPortal(
          <div className="suggest-toast" role="status" aria-live="polite">
            <div
              className={`suggest-toast__card suggest-toast__card--${toast}`}
            >
              {toast === 'loading' ? (
                <>
                  <span className="suggest-toast__spinner" aria-hidden="true" />
                  <p>{t('playlists.suggestLoadingHint')}</p>
                </>
              ) : null}
              {toast === 'success' ? (
                <>
                  <span className="suggest-toast__check" aria-hidden="true">
                    ✓
                  </span>
                  <p>{t('playlists.suggestSuccess')}</p>
                </>
              ) : null}
              {toast === 'error' ? (
                <>
                  <span className="suggest-toast__fail" aria-hidden="true">
                    !
                  </span>
                  <p>{t('playlists.suggestErrorShort')}</p>
                </>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <section className="suggest-tracks" aria-labelledby="suggest-tracks-title" aria-busy={busy}>
      {toastNode}

      <div className="suggest-tracks__head">
        <div>
          <h2 id="suggest-tracks-title">{t('playlists.suggestTitle')}</h2>
          <p>{t('playlists.suggestSubtitle')}</p>
        </div>
        <button
          type="button"
          className="playlists__btn playlists__btn--accent suggest-tracks__action"
          onClick={fetchSuggestions}
          disabled={busy}
        >
          {busy ? t('playlists.suggestLoading') : t('playlists.suggestAction')}
        </button>
      </div>

      {error ? <p className="playlists__error">{error}</p> : null}
      {flash ? <p className="suggest-tracks__flash">{flash}</p> : null}

      {fetched && visible.length === 0 && !error && !busy ? (
        <p className="suggest-tracks__empty">{t('playlists.suggestDone')}</p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="suggest-tracks__list">
          {visible.map((track) => {
            const isPlaying = idEq(playingTrackId, track.id)
            return (
              <li key={track.id} className={`suggest-tracks__item${isPlaying ? ' is-playing' : ''}`}>
                <button
                  type="button"
                  className="suggest-tracks__cover"
                  onClick={() => playTrack(track.id)}
                  aria-label={
                    isPlaying
                      ? t('common.pauseAria', { title: track.title })
                      : t('common.playAria', { title: track.title })
                  }
                >
                  <img src={track.cover || track.coverImage} alt="" />
                  {isPlaying ? <PlayingBars /> : null}
                </button>
                <div className="suggest-tracks__text">
                  <button
                    type="button"
                    className="suggest-tracks__title"
                    onClick={() => playTrack(track.id)}
                  >
                    {track.title}
                  </button>
                  <p>
                    <Link to={artistPath(track.artistId)}>{track.artistName}</Link>
                    {track.genre ? (
                      <>
                        <span aria-hidden="true"> • </span>
                        <span>{track.genre}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="playlists__btn playlists__btn--primary"
                  onClick={() => handleAdd(track.id)}
                  disabled={busy}
                >
                  {t('playlists.add')}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {reserve.length > 0 ? (
        <p className="suggest-tracks__reserve">
          {t('playlists.suggestReserve', { count: reserve.length })}
        </p>
      ) : null}
    </section>
  )
}
