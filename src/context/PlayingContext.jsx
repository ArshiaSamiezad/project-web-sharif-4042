import { createContext, useContext, useState } from 'react'
import * as storage from '../lib/storage'

const PlayingContext = createContext(null)

export function PlayingProvider({ children }) {
  const [playingTrackId, setPlayingTrackId] = useState(() =>
    storage.getItem('nowPlayingTrackId', null),
  )

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

  return (
    <PlayingContext.Provider
      value={{ playingTrackId, playTrack, stopPlayback, isPlaying: Boolean(playingTrackId) }}
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
