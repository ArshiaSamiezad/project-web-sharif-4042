import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from 'react'
import * as storage from '../lib/storage'
import { useAuth } from './AuthContext'
import useAudioPlayer from '../hooks/useAudioPlayer'
import { idEq } from '../lib/ids'

const PlayingContext = createContext(null)
const DEFAULT_VOLUME = 1
const PLAYBACK_SOURCE_KEY = 'nowPlayingSourceTrackIds'

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

function hasSameTrackOrder(left, right) {
  if (left.length !== right.length) return false
  return left.every((track, index) => idEq(track.id, right[index]?.id))
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
    if (!engine.currentTrack || !engine.playlist.length) return
    storage.setItem(
      PLAYBACK_SOURCE_KEY,
      engine.playlist.map((track) => track.id),
    )
  }, [engine.currentTrack, engine.playlist])

  useEffect(() => {
    if (hasResumedRef.current) return
    if (!catalog.tracks.length) return
    hasResumedRef.current = true
    const savedId = storage.getItem('nowPlayingTrackId', null)
    if (!savedId) return
    const savedSourceIds = storage.getItem(PLAYBACK_SOURCE_KEY, [])
    const source = Array.isArray(savedSourceIds)
      ? savedSourceIds
          .map((id) => catalog.tracks.find((track) => idEq(track.id, id)))
          .filter(Boolean)
      : []
    const fallbackTrack = catalog.tracks.find((track) => idEq(track.id, savedId))
    const pool = withAlbumNames(source.length ? source : fallbackTrack ? [fallbackTrack] : [], catalog.albums)
    const track = pool.find((t) => idEq(t.id, savedId))
    if (track) engine.playTrack(track, pool)
  }, [catalog.tracks, catalog.albums, engine])

  const playTrack = useCallback((trackId, list) => {
    if (!trackId) return
    const { tracks, albums } = catalogRef.current
    const requestedSource = Array.isArray(list)
      ? list
      : tracks.filter((track) => idEq(track.id, trackId))
    const pool = withAlbumNames(requestedSource, albums)
    const track = pool.find((t) => idEq(t.id, trackId))
    if (!track) return
    if (
      idEq(engine.currentTrack?.id, trackId) &&
      hasSameTrackOrder(engine.playlist, pool)
    ) {
      engine.togglePlay()
      return
    }
    engine.playTrack(track, pool)
  }, [engine])

  const stopPlayback = useCallback(() => {
    engine.pause()
    engine.seek(0)
  }, [engine])

  const value = useMemo(
    () => ({
      ...engine,
      setVolume: engine.setVolume,
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
