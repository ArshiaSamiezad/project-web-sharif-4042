import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayingProvider, usePlaying } from '../context/PlayingContext'

const state = vi.hoisted(() => ({
  catalog: {
    tracks: [
      { id: '1', title: 'First', albumId: 'a', audioUrl: '/first.mp3' },
      { id: '2', title: 'Second', albumId: 'a', audioUrl: '/second.mp3' },
      { id: '3', title: 'Single', albumId: null, audioUrl: '/single.mp3' },
    ],
    albums: [{ id: 'a', title: 'Album' }],
  },
  engine: null,
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ getCatalog: () => state.catalog }),
}))

vi.mock('../hooks/useAudioPlayer', () => ({
  default: () => state.engine,
}))

function Harness() {
  const { playTrack } = usePlaying()
  const albumOrder = [state.catalog.tracks[1], state.catalog.tracks[0]]
  return (
    <>
      <button type="button" onClick={() => playTrack('3')}>single</button>
      <button type="button" onClick={() => playTrack('2', albumOrder)}>album</button>
    </>
  )
}

function renderPlayer() {
  return render(
    <PlayingProvider>
      <Harness />
    </PlayingProvider>,
  )
}

describe('PlayingProvider playback sources', () => {
  beforeEach(() => {
    localStorage.clear()
    state.engine = {
      currentTrack: null,
      playlist: [],
      volume: 1,
      playTrack: vi.fn(),
      togglePlay: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
    }
  })

  it('treats a track without an explicit source as a single-track playback', () => {
    renderPlayer()
    fireEvent.click(screen.getByRole('button', { name: 'single' }))

    expect(state.engine.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: '3' }),
      [expect.objectContaining({ id: '3' })],
    )
  })

  it('preserves the exact order supplied by an album or playlist', () => {
    renderPlayer()
    fireEvent.click(screen.getByRole('button', { name: 'album' }))

    const [, source] = state.engine.playTrack.mock.calls[0]
    expect(source.map((track) => track.id)).toEqual(['2', '1'])
  })

  it('toggles playback when the same track is clicked in the same source', () => {
    state.engine.currentTrack = state.catalog.tracks[2]
    state.engine.playlist = [state.catalog.tracks[2]]
    renderPlayer()
    state.engine.playTrack.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'single' }))

    expect(state.engine.togglePlay).toHaveBeenCalledOnce()
    expect(state.engine.playTrack).not.toHaveBeenCalled()
  })
})
