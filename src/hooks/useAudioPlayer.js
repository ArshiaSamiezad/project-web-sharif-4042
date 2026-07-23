// Developer: Moeid Nadi - 402106683
import { useState, useRef, useEffect, useCallback } from "react";

const CROSSFADE_SECONDS = 5;

/**
 * useAudioPlayer
 * Drives a single logical "player" backed by up to two native Audio()
 * instances at once (current + next) so we can crossfade between tracks.
 *
 * @param {Array} initialPlaylist - array of { id, title, artist, cover, audioUrl }
 */
export default function useAudioPlayer(initialPlaylist = []) {
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [queue, setQueue] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(initialPlaylist[0] || null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(0); // 0: off, 1: all, 2: one
  const [isCrossfading, setIsCrossfading] = useState(false);

  // Lazily create the primary audio element once.
  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio();
  }

  const nextAudioRef = useRef(null);
  const rafRef = useRef(null);
  const isCrossfadingRef = useRef(false);
  const loadedTrackIdRef = useRef(null);
  const volumeRef = useRef(1);
  const mutedRef = useRef(false);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  const effectiveVolume = useCallback(() => (mutedRef.current ? 0 : volumeRef.current), []);

  // ---- Resolve "what plays next" from queue -> shuffle -> linear playlist ----
  const peekNextTrack = useCallback(() => {
    if (queue.length > 0) return { track: queue[0], fromQueue: true };
    if (!playlist.length || !currentTrack) return { track: null, fromQueue: false };

    if (shuffle) {
      const others = playlist.filter((t) => t.id !== currentTrack.id);
      if (!others.length) return { track: currentTrack, fromQueue: false };
      const pick = others[Math.floor(Math.random() * others.length)];
      return { track: pick, fromQueue: false };
    }

    const idx = playlist.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = idx + 1;
    if (nextIdx >= playlist.length) {
      return { track: repeat === 1 ? playlist[0] : null, fromQueue: false };
    }
    return { track: playlist[nextIdx], fromQueue: false };
  }, [queue, playlist, currentTrack, shuffle, repeat]);

  // ---- Hard jump to the next track (no crossfade) ----
  const advanceToNext = useCallback(() => {
    const { track, fromQueue } = peekNextTrack();
    if (fromQueue) setQueue((q) => q.slice(1));

    if (track) {
      loadedTrackIdRef.current = null;
      setCurrentTrack(track);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [peekNextTrack]);

  // ---- Crossfade: fade current out / next in over the last N seconds ----
  const startCrossfade = useCallback(() => {
    if (isCrossfadingRef.current) return;
    const current = audioRef.current;
    if (!current || !current.duration) return;

    const { track, fromQueue } = peekNextTrack();
    if (!track) return;

    isCrossfadingRef.current = true;
    setIsCrossfading(true);

    const incoming = new Audio(track.audioUrl);
    incoming.volume = 0;
    nextAudioRef.current = incoming;
    incoming.play().catch(() => {});

    const target = effectiveVolume();
    const remainingMs = Math.max((current.duration - current.currentTime) * 1000, 250);
    const fadeMs = Math.min(CROSSFADE_SECONDS * 1000, remainingMs);
    const start = performance.now();

    const finish = () => {
      current.pause();
      current.src = "";
      audioRef.current = incoming;
      nextAudioRef.current = null;
      isCrossfadingRef.current = false;
      setIsCrossfading(false);
      loadedTrackIdRef.current = track.id; // already loaded/playing, skip reload effect
      if (fromQueue) setQueue((q) => q.slice(1));
      setCurrentTrack(track);
      setDuration(incoming.duration || 0);
    };

    const step = (now) => {
      if (!isCrossfadingRef.current) return; // cancelled externally
      const t = Math.min((now - start) / fadeMs, 1);
      current.volume = target * (1 - t);
      incoming.volume = target * t;

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        finish();
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [peekNextTrack, effectiveVolume]);

  const cancelCrossfade = useCallback(() => {
    if (!isCrossfadingRef.current) return;
    cancelAnimationFrame(rafRef.current);
    isCrossfadingRef.current = false;
    setIsCrossfading(false);
    nextAudioRef.current?.pause();
    nextAudioRef.current = null;
    if (audioRef.current) audioRef.current.volume = effectiveVolume();
  }, [effectiveVolume]);

  // ---- Load a new src whenever currentTrack changes (skips if crossfade already loaded it) ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (loadedTrackIdRef.current === currentTrack.id) return;

    loadedTrackIdRef.current = currentTrack.id;
    audio.src = currentTrack.audioUrl;
    audio.currentTime = 0;
    audio.volume = effectiveVolume();
    setCurrentTime(0);
    if (isPlaying) audio.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack]);

  // ---- Bind media events to whichever audio element is currently "live" ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const remaining = audio.duration - audio.currentTime;
      if (
        !isCrossfadingRef.current &&
        repeat !== 2 &&
        audio.duration &&
        remaining > 0 &&
        remaining <= CROSSFADE_SECONDS
      ) {
        startCrossfade();
      }
    };
    const onLoadedMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (isCrossfadingRef.current) return; // handled by crossfade finish()
      if (repeat === 2) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        advanceToNext();
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrack, repeat, startCrossfade, advanceToNext]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      nextAudioRef.current?.pause();
    };
  }, []);

  // ---------------- Public controls ----------------

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    audio.play().catch(() => {});
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const changeVolume = useCallback((v) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    if (!isCrossfadingRef.current && audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      if (!isCrossfadingRef.current && audioRef.current) {
        audioRef.current.volume = next ? 0 : volumeRef.current;
      }
      return next;
    });
  }, []);

  const playNext = useCallback(() => {
    cancelCrossfade();
    advanceToNext();
  }, [cancelCrossfade, advanceToNext]);

  const playPrevious = useCallback(() => {
    cancelCrossfade();
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }
    if (!playlist.length || !currentTrack) return;
    const idx = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = idx - 1 < 0 ? playlist.length - 1 : idx - 1;
    loadedTrackIdRef.current = null;
    setCurrentTrack(playlist[prevIdx]);
    setIsPlaying(true);
  }, [cancelCrossfade, playlist, currentTrack, seek]);

  const playTrack = useCallback(
    (track, list) => {
      cancelCrossfade();
      loadedTrackIdRef.current = null;
      if (list) setPlaylist(list);
      setCurrentTrack(track);
      setIsPlaying(true);
    },
    [cancelCrossfade]
  );

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const cycleRepeat = useCallback(() => setRepeat((r) => (r + 1) % 3), []);

  const addToQueue = useCallback((track) => setQueue((q) => [...q, track]), []);
  const removeFromQueue = useCallback(
    (index) => setQueue((q) => q.filter((_, i) => i !== index)),
    []
  );
  const clearQueue = useCallback(() => setQueue([]), []);

  return {
    // state
    currentTrack,
    playlist,
    queue,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    isCrossfading,
    // controls
    play,
    pause,
    togglePlay,
    seek,
    changeVolume,
    toggleMute,
    playNext,
    playPrevious,
    playTrack,
    toggleShuffle,
    cycleRepeat,
    // queue
    addToQueue,
    removeFromQueue,
    clearQueue,
    setPlaylist,
  };
}
