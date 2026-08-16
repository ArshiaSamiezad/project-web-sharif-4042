import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from 'react'
import * as storage from '../lib/storage'
import { useAuth } from './AuthContext'
import useAudioPlayer from '../hooks/useAudioPlayer'
import { idEq } from '../lib/ids'

const PlayingContext = createContext(null)
const DEFAULT_VOLUME = 80

function withAlbumNames(tracks, albums) {
  const albumTitleById = new Map((albums || []).map((a) => [String(a.id), a.title]))
  return (tracks || []).map((t) =>
    t.albumName
      ? t
      : {
          ...t,
          albumName: t.albumId ? albumTitleById.get(String(t.albumId)) ?? null : null,
        },
  )
}

export function PlayingProvider({ children }) {
  const { getCatalog } = useAuth()
  const catalog = getCatalog()
  const engine = useAudioPlayer([])
  const lastPersistedId = useRef(null)
  const hasResumedRef = useRef(false)
  const catalogRef = useRef(catalog)
  catalogRef.current = catalog

  useEffect(() => {
    const id = engine.currentTrack?.id ?? null
    if (id === lastPersistedId.current) return
    lastPersistedId.current = id
    if (id) storage.setItem('nowPlayingTrackId', id)
    else storage.removeItem('nowPlayingTrackId')
  }, [engine.currentTrack])

  useEffect(() => {
    if (hasResumedRef.current) return
    if (!catalog.tracks.length) return
    hasResumedRef.current = true
    const savedId = storage.getItem('nowPlayingTrackId', null)
    if (!savedId) return
    const pool = withAlbumNames(catalog.tracks, catalog.albums)
    const track = pool.find((t) => idEq(t.id, savedId))
    if (track) engine.playTrack(track, pool)
  }, [catalog.tracks, catalog.albums, engine])

  const playTrack = useCallback((trackId, list) => {
    if (!trackId) return
    if (idEq(engine.currentTrack?.id, trackId)) {
      engine.togglePlay()
      return
    }
    const { tracks, albums } = catalogRef.current
    const pool = list ? withAlbumNames(list, albums) : withAlbumNames(tracks, albums)
    const track = pool.find((t) => idEq(t.id, trackId))
    if (!track) return
    engine.playTrack(track, pool)
  }, [engine])

  const stopPlayback = useCallback(() => {
    engine.pause()
    engine.seek(0)
  }, [engine])

  const value = useMemo(
    () => ({
      ...engine,
      setVolume: engine.setVolume || engine.changeVolume,
      volume: engine.volume ?? DEFAULT_VOLUME,
      playingTrackId: engine.currentTrack?.id ?? null,
      playTrack,
      stopPlayback,
    }),
    [engine, playTrack, stopPlayback],
  )

  return <PlayingContext.Provider value={value}>{children}</PlayingContext.Provider>
}

export function usePlaying() {
  const ctx = useContext(PlayingContext)
  if (!ctx) throw new Error('usePlaying must be used within PlayingProvider')
  return ctx
}
