import { useEffect, useState } from 'react'
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

export default function SuggestTracksPanel({ playlistId }) {
  const { currentUser, getCatalog, getUserById, getUserMaps, toggleTrackInPlaylist } = useAuth()
  const { playingTrackId, playTrack } = usePlaying()
  const { t } = useI18n()
  const catalog = getCatalog()

  const [{ visible, reserve }, setBundle] = useState({ visible: [], reserve: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [fetched, setFetched] = useState(false)

  const playlist = catalog.playlists.find((item) => idEq(item.id, playlistId))

  useEffect(() => {
    setBundle({ visible: [], reserve: [] })
    setError('')
    setFlash('')
    setFetched(false)
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
    setLoading(true)
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
      }
    } catch (err) {
      setError(err?.message || t('playlists.suggestError'))
      setBundle({ visible: [], reserve: [] })
      setFetched(true)
    } finally {
      setLoading(false)
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

  return (
    <section className="suggest-tracks" aria-labelledby="suggest-tracks-title">
      <div className="suggest-tracks__head">
        <div>
          <h2 id="suggest-tracks-title">{t('playlists.suggestTitle')}</h2>
          <p>{t('playlists.suggestSubtitle')}</p>
        </div>
        <button
          type="button"
          className="playlists__btn playlists__btn--accent"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          {loading ? t('playlists.suggestLoading') : t('playlists.suggestAction')}
        </button>
      </div>

      {error ? <p className="playlists__error">{error}</p> : null}
      {flash ? <p className="suggest-tracks__flash">{flash}</p> : null}

      {fetched && !loading && visible.length === 0 && !error ? (
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
