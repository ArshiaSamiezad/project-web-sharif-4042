import { createContext, useContext, useState } from 'react'
import * as storage from '../lib/storage'

const PlayingContext = createContext(null)
const DEFAULT_VOLUME = 80

export function PlayingProvider({ children }) {
  const [playingTrackId, setPlayingTrackId] = useState(() =>
    storage.getItem('nowPlayingTrackId', null),
  )
  const [volume, setVolumeState] = useState(() => {
    const stored = storage.getItem('systemVolume', null)
    if (typeof stored === 'number') return stored
    return DEFAULT_VOLUME
  })

  function playTrack(trackId) {
    if (!trackId) return
    if (playingTrackId === trackId) {
      setPlayingTrackId(null)
      storage.removeItem('nowPlayingTrackId')
      return
    }
    setPlayingTrackId(trackId)
    storage.setItem('nowPlayingTrackId', trackId)
  }

  function stopPlayback() {
    setPlayingTrackId(null)
    storage.removeItem('nowPlayingTrackId')
  }

  function setVolume(next) {
    const clamped = Math.min(100, Math.max(0, Number(next) || 0))
    setVolumeState(clamped)
    storage.setItem('systemVolume', clamped)
  }

  return (
    <PlayingContext.Provider
      value={{
        playingTrackId,
        playTrack,
        stopPlayback,
        isPlaying: Boolean(playingTrackId),
        volume,
        setVolume,
      }}
    >
      {children}
    </PlayingContext.Provider>
  )
}

export function usePlaying() {
  const ctx = useContext(PlayingContext)
  if (!ctx) throw new Error('usePlaying must be used within PlayingProvider')
  return ctx
}
