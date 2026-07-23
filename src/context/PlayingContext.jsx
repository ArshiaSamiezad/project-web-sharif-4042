
import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from 'react'
import * as storage from '../lib/storage'
import useAudioPlayer from '../hooks/useAudioPlayer'

const PlayingContext = createContext(null)

function getTracks() {
  return storage.getItem('tracks', [])
}

function getAlbums() {
  return storage.getItem('albums', [])
}

/**
 * Attaches `albumName` to every track (resolved from the albums store via
 * albumId) so the full-screen player's "Playing from album" link always has
 * something to show, on manual plays AND on auto-advance/crossfade.
 */
function withAlbumNames(tracks) {
  const albumTitleById = new Map(getAlbums().map((a) => [a.id, a.title]))
  return tracks.map((t) =>
    t.albumName ? t : { ...t, albumName: t.albumId ? albumTitleById.get(t.albumId) ?? null : null }
  )
}

function getEnrichedTracks() {
  return withAlbumNames(getTracks())
}
const DEFAULT_VOLUME = 80

export function PlayingProvider({ children }) {
  // The real audio engine — volume/progress/queue/shuffle/repeat/crossfade
  // all live here. PlayingContext wraps it so the whole app shares one
  // instance instead of every consumer creating its own <audio> element.
  const engine = useAudioPlayer([])
  const lastPersistedId = useRef(null)
  const hasResumedRef = useRef(false)

  // Persist which track is loaded so a page refresh remembers "now playing"
  // (mirrors the old nowPlayingTrackId behavior).
  useEffect(() => {
    const id = engine.currentTrack?.id ?? null
    if (id === lastPersistedId.current) return
    lastPersistedId.current = id
    if (id) storage.setItem('nowPlayingTrackId', id)
    else storage.removeItem('nowPlayingTrackId')
  }, [engine.currentTrack])

  // On first mount, reload whatever track was marked as "now playing".
  // This does NOT force playback — browsers block autoplay without a user
  // gesture anyway, so it just restores the art/metadata in a paused state.
  useEffect(() => {
    if (hasResumedRef.current) return
    hasResumedRef.current = true
    const savedId = storage.getItem('nowPlayingTrackId', null)
    if (!savedId) return
    const pool = getEnrichedTracks()
    const track = pool.find((t) => t.id === savedId)
    if (track) engine.playTrack(track, pool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * playTrack(trackId, list?)
   * Back-compat wrapper for existing call sites (`playTrack(track.id)`).
   * Behavior change from the old context: clicking the currently-loaded
   * track now toggles play/pause instead of unloading it entirely — this
   * preserves seek position and matches how every real player behaves.
   * `stopPlayback` is still available for a true full stop.
   */
  const playTrack = useCallback(
    (trackId, list) => {
      if (!trackId) return
      if (engine.currentTrack?.id === trackId) {
        engine.togglePlay()
        return
      }
      const pool = list ? withAlbumNames(list) : getEnrichedTracks()
      const track = pool.find((t) => t.id === trackId)
      if (!track) return
      engine.playTrack(track, pool)
    },
    [engine]
  )

  const stopPlayback = useCallback(() => {
    engine.pause()
    engine.seek(0)
  }, [engine])

  const value = useMemo(
    () => ({
      ...engine,
      // Back-compat field name some pages may already read directly.
      setVolume: engine.setVolume || engine.changeVolume, // جایگزینی اسم تابع
      playingTrackId: engine.currentTrack?.id ?? null,
      playTrack,
      stopPlayback,
    }),
    [engine, playTrack, stopPlayback]
  )

  return <PlayingContext.Provider value={value}>{children}</PlayingContext.Provider>
}

export function usePlaying() {
  const ctx = useContext(PlayingContext)
  if (!ctx) throw new Error('usePlaying must be used within PlayingProvider')
  return ctx
}